import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import { mergePlatformMasterWithTenantOverrides } from "@/lib/engine/PlatformMergeEngine";
import type {
  ComponentNode,
  PageStyleSheet,
  TenantOverrides,
  ThemeConfig,
} from "@/types";
import { hydratePlatformPageComponents } from "@/lib/engine/platformPageComponents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RuntimeSnapshot {
  platformId: string;
  platformSlug: string;
  platformName: string;
  themeConfig: ThemeConfig;
  pages?: Array<{
    id: string;
    title?: string;
    componentTree?: ComponentNode[];
    styleSheet?: PageStyleSheet;
    layoutRegions?: Record<string, boolean>;
  }>;
  forms?: unknown[];
  collections?: unknown[];
  routes?: Array<Record<string, any>>;
  services?: Array<Record<string, any>>;
  flows?: unknown[];
  generatedAt: string;
}

interface SnapshotRow {
  app_id: string | null;
  runtime_snapshot: RuntimeSnapshot;
  platform_slug: string;
  app_slug: string | null;
  app_name: string | null;
  app_port: number | null;
  app_subdomain: string | null;
  tenant_db_name: string | null;
  theme_config: ThemeConfig | null;
  tenant_overrides: TenantOverrides | null;
}

interface RuntimeAppPageRow {
  page_slug: string;
  sync_mode: "FOLLOW_MASTER" | "PINNED" | "DETACHED";
  page_overrides: Record<string, unknown> | null;
  component_tree_override: ComponentNode[] | null;
  detached_component_tree: ComponentNode[] | null;
  style_overrides: PageStyleSheet | null;
  layout_overrides: Record<string, boolean> | null;
}

const resolveAppPages = async (
  appId: string | null,
  masterPages: NonNullable<RuntimeSnapshot["pages"]>,
) => {
  if (!appId) return masterPages;
  const result = await getCoreDb().query<RuntimeAppPageRow>(
    `SELECT pp.page_slug, pap.sync_mode, pap.page_overrides,
            pap.component_tree_override, pap.detached_component_tree,
            pap.style_overrides, pap.layout_overrides
     FROM public.platform_app_pages pap
     JOIN public.platform_pages pp ON pp.id=pap.platform_page_id
     WHERE pap.app_id=$1`,
    [appId],
  );
  const instances = new Map(result.rows.map((row) => [row.page_slug, row]));
  return masterPages.map((master) => {
    const instance = instances.get(master.id);
    if (!instance) return master;
    const detached = instance.sync_mode === "DETACHED";
    const overrideRules = instance.style_overrides?.rules || [];
    return {
      ...master,
      ...(instance.page_overrides || {}),
      id: master.id,
      componentTree: detached
        ? instance.detached_component_tree ||
          instance.component_tree_override ||
          master.componentTree
        : instance.component_tree_override || master.componentTree,
      styleSheet: detached
        ? instance.style_overrides || master.styleSheet
        : master.styleSheet || overrideRules.length
          ? {
              scopeId:
                master.styleSheet?.scopeId ||
                instance.style_overrides?.scopeId ||
                `page-${master.id}`,
              rules: [...(master.styleSheet?.rules || []), ...overrideRules],
            }
          : undefined,
      layoutRegions: {
        ...(master.layoutRegions || {}),
        ...(instance.layout_overrides || {}),
      },
    };
  });
};

/**
 * Runtime payload for a published site.
 *
 * `slug` resolves as a Tenant App first — so the master layout is merged with
 * that tenant's overrides (PlatformModule.MD §3) — and falls back to the
 * Platform Master itself when no app owns the slug.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const result = await getCoreDb().query<SnapshotRow>(
    `SELECT p.runtime_snapshot, p.platform_slug, a.id AS app_id,
            a.app_slug, a.app_name, a.port AS app_port, a.subdomain AS app_subdomain,
            a.tenant_db_name, a.theme_config, a.tenant_overrides
     FROM public.platforms p
     LEFT JOIN public.apps a ON a.platform_id = p.id AND a.app_slug = $1 AND a.is_active
     WHERE (a.app_slug = $1 OR p.platform_slug = $1)
       AND p.runtime_snapshot IS NOT NULL
     ORDER BY a.app_slug NULLS LAST
     LIMIT 1`,
    [slug],
  );

  if (!result.rowCount) {
    return NextResponse.json(
      { error: "Published runtime snapshot not found" },
      { status: 404 },
    );
  }

  const row = result.rows[0];
  const snapshot = row.runtime_snapshot;
  const resolvedPages = await hydratePlatformPageComponents(
    snapshot.platformId,
    await resolveAppPages(row.app_id, snapshot.pages || []),
  );
  const surface = process.env.APP_SURFACE || "frontend";

  // Routes and services decide the entry page (dev: service/route driven start
  // point); tenant overrides then shape what that page actually renders.
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const services = Array.isArray(snapshot.services) ? snapshot.services : [];
  const surfaceRoutes = routes.filter((item) =>
    String(item.containerName || "").endsWith(`-${surface}`),
  );
  const startRoute =
    surfaceRoutes.find(
      (item) => item.isDefault || item.metadata?.isStartPoint,
    ) ||
    routes.find(
      (item) =>
        (item.isDefault || item.metadata?.isStartPoint) &&
        item.targetType === "service",
    );
  const startService =
    startRoute?.targetType === "service"
      ? services.find((item) => item.id === startRoute.targetId)
      : undefined;
  const startPageId =
    startService?.bundle?.loginPageId ||
    (startRoute?.targetType === "page" ? startRoute.targetId : undefined);

  const page =
    resolvedPages.find((item) => item.id === startPageId) ||
    resolvedPages.find(
      (item) => item.id === (surface === "backend" ? "admin" : "index"),
    ) ||
    resolvedPages.find((item) => item.id === "index") ||
    resolvedPages[0];

  // Tenant overrides can disable features and patch component props without
  // forking the master blueprint.
  const componentTree = mergePlatformMasterWithTenantOverrides(
    page?.componentTree ?? [],
    row.tenant_overrides ?? undefined,
  );

  const themeConfig: ThemeConfig = {
    ...snapshot.themeConfig,
    ...(row.theme_config ?? {}),
    ...(row.tenant_overrides?.themeOverrides ?? {}),
  };

  const isTenantApp = Boolean(row.app_slug);

  return NextResponse.json({
    appConfig: {
      id: snapshot.platformId,
      appSlug: row.app_slug ?? snapshot.platformSlug,
      appName: row.app_name ?? snapshot.platformName,
      /*
       * This endpoint needs no session — it is what a published site reads —
       * so it must not carry internal topology. The database behind the site
       * and the port it listens on are of no use to a visitor and tell anyone
       * else exactly what to aim at.
       */
      port: 0,
      subdomain: row.app_subdomain ?? `${snapshot.platformSlug}.localhost`,
      tenantDbName: "",
      platformId: snapshot.platformId,
      inheritedFrom: isTenantApp ? snapshot.platformName : undefined,
      themeConfig,
      createdAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
    },
    pageLayout: {
      id: `${snapshot.platformId}:${page?.id ?? "index"}`,
      appId: snapshot.platformId,
      pageSlug: page?.id || "index",
      title: page?.title || "Home",
      isDefaultPage: true,
      componentTree,
      styleSheet: page?.styleSheet,
      layoutRegions: page?.layoutRegions,
      createdAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
    },
    forms: snapshot.forms || [],
    collections: snapshot.collections || [],
    routes: snapshot.routes || [],
    pages: resolvedPages,
    services,
    flows: snapshot.flows || [],
  });
}
