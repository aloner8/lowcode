import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";
import type { ComponentNode, PageStyleSheet } from "@/types";
import {
  hydratePlatformPageComponents,
  stripHydratedPageComponentNodes,
} from "@/lib/engine/platformPageComponents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type SyncMode = "FOLLOW_MASTER" | "PINNED" | "DETACHED";

interface AppPageRow {
  master_id: string;
  page_slug: string;
  title: string;
  component_tree: ComponentNode[];
  page_config: Record<string, unknown>;
  master_version: number;
  master_updated_at: Date;
  instance_id: string | null;
  sync_mode: SyncMode | null;
  base_master_version: number | null;
  page_overrides: Record<string, unknown> | null;
  component_tree_override: ComponentNode[] | null;
  style_overrides: PageStyleSheet | { rules?: PageStyleSheet["rules"] } | null;
  collection_bindings: Record<string, unknown> | null;
  layout_overrides: Record<string, boolean> | null;
  disabled_component_ids: string[] | null;
  detached_component_tree: ComponentNode[] | null;
  detached_at: Date | null;
}

const assertApp = async (platformId: string, appId: string) => {
  const result = await getCoreDb().query<{
    id: string;
    app_name: string;
    app_slug: string;
  }>(
    `SELECT id, app_name, app_slug FROM public.apps
     WHERE id=$1 AND platform_id=$2 AND is_active`,
    [appId, platformId],
  );
  return result.rows[0] || null;
};

const mergeStyleSheets = (
  master: PageStyleSheet | undefined,
  overrides: AppPageRow["style_overrides"],
): PageStyleSheet | undefined => {
  const overrideRules = Array.isArray(overrides?.rules) ? overrides.rules : [];
  if (!master && !overrideRules.length) return undefined;
  const overrideScopeId =
    overrides && "scopeId" in overrides && typeof overrides.scopeId === "string"
      ? overrides.scopeId
      : undefined;
  return {
    scopeId: master?.scopeId || overrideScopeId || "app-page",
    rules: [...(master?.rules || []), ...overrideRules],
  };
};

const createStyleOverrides = (
  master: PageStyleSheet | undefined,
  incoming: PageStyleSheet | undefined,
): PageStyleSheet => {
  const masterRules = master?.rules || [];
  const rules = (incoming?.rules || []).filter((rule) => {
    const masterRule = masterRules.find(
      (candidate) => candidate.id === rule.id,
    );
    return !masterRule || JSON.stringify(masterRule) !== JSON.stringify(rule);
  });
  return { scopeId: incoming?.scopeId || master?.scopeId || "app-page", rules };
};

const createLayoutOverrides = (
  master: Record<string, boolean>,
  incoming: Record<string, boolean>,
) =>
  Object.fromEntries(
    Object.entries(incoming).filter(([key, value]) => master[key] !== value),
  );

const resolvePage = (row: AppPageRow) => {
  const masterStyleSheet = row.page_config.styleSheet as
    PageStyleSheet | undefined;
  const masterLayoutRegions = (row.page_config.layoutRegions || {}) as Record<
    string,
    boolean
  >;
  const isDetached = row.sync_mode === "DETACHED";
  const componentTree = isDetached
    ? row.detached_component_tree ||
      row.component_tree_override ||
      row.component_tree
    : row.component_tree_override || row.component_tree;
  const overrideTitle = row.page_overrides?.title;
  return {
    ...row.page_config,
    ...(row.page_overrides || {}),
    id: row.page_slug,
    title: typeof overrideTitle === "string" ? overrideTitle : row.title,
    componentTree,
    styleSheet: isDetached
      ? (row.style_overrides as PageStyleSheet | null) || masterStyleSheet
      : mergeStyleSheets(masterStyleSheet, row.style_overrides),
    layoutRegions: { ...masterLayoutRegions, ...(row.layout_overrides || {}) },
    collectionBindings: row.collection_bindings || {},
    disabledComponentIds: row.disabled_component_ids || [],
    instance: {
      id: row.instance_id,
      masterPageId: row.master_id,
      syncMode: row.sync_mode || "FOLLOW_MASTER",
      baseMasterVersion: row.base_master_version || row.master_version,
      masterVersion: row.master_version,
      masterUpdatedAt: row.master_updated_at.toISOString(),
      detachedAt: row.detached_at?.toISOString(),
      hasOverrides: Boolean(
        row.component_tree_override ||
        row.detached_component_tree ||
        Object.keys(row.page_overrides || {}).length ||
        Object.keys(row.layout_overrides || {}).length ||
        row.style_overrides?.rules?.length ||
        0,
      ),
    },
  };
};

const selectAppPages = `
  SELECT pp.id AS master_id, pp.page_slug, pp.title, pp.component_tree,
         pp.page_config, pp.version AS master_version, pp.updated_at AS master_updated_at,
         pap.id AS instance_id, pap.sync_mode, pap.base_master_version,
         pap.page_overrides, pap.component_tree_override, pap.style_overrides,
         pap.collection_bindings, pap.layout_overrides, pap.disabled_component_ids,
         pap.detached_component_tree, pap.detached_at
  FROM public.platform_pages pp
  LEFT JOIN public.platform_app_pages pap
    ON pap.platform_page_id=pp.id AND pap.app_id=$2
  WHERE pp.platform_id=$1
  ORDER BY pp.created_at`;

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, "VIEWER");
  if (auth instanceof NextResponse) return auth;
  const appId = new URL(request.url).searchParams.get("appId") || "";
  const app = await assertApp(id, appId);
  if (!app)
    return NextResponse.json(
      { error: "App does not belong to this Platform" },
      { status: 404 },
    );
  const result = await getCoreDb().query<AppPageRow>(selectAppPages, [
    id,
    appId,
  ]);
  const pages = await hydratePlatformPageComponents(
    id,
    result.rows.map(resolvePage),
  );
  return NextResponse.json({
    app: { id: app.id, name: app.app_name, slug: app.app_slug },
    pages,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, "STAFF");
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    appId?: string;
    pageId?: string;
    action?: "save" | "detach";
    page?: Record<string, unknown>;
  };
  const appId = body.appId || "";
  const pageId = body.pageId || "";
  const app = await assertApp(id, appId);
  if (!app)
    return NextResponse.json(
      { error: "App does not belong to this Platform" },
      { status: 404 },
    );
  const masterResult = await getCoreDb().query<AppPageRow>(selectAppPages, [
    id,
    appId,
  ]);
  const master = masterResult.rows.find((row) => row.page_slug === pageId);
  if (!master)
    return NextResponse.json(
      { error: "Master Page not found" },
      { status: 404 },
    );

  if (body.action === "detach") {
    const resolved = resolvePage(master);
    const resolvedRecord = resolved as typeof resolved &
      Record<string, unknown>;
    await getCoreDb().query(
      `INSERT INTO public.platform_app_pages
        (app_id,platform_page_id,instance_key,sync_mode,base_master_version,base_master_updated_at,
         page_overrides,detached_component_tree,style_overrides,layout_overrides,detached_at)
       VALUES ($1,$2,$3,'DETACHED',$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NOW())
       ON CONFLICT (app_id,platform_page_id) DO UPDATE SET
         sync_mode='DETACHED',base_master_version=EXCLUDED.base_master_version,
         base_master_updated_at=EXCLUDED.base_master_updated_at,
         page_overrides=EXCLUDED.page_overrides,component_tree_override=NULL,
         detached_component_tree=EXCLUDED.detached_component_tree,
         style_overrides=EXCLUDED.style_overrides,layout_overrides=EXCLUDED.layout_overrides,
         detached_at=NOW()`,
      [
        appId,
        master.master_id,
        pageId,
        master.master_version,
        master.master_updated_at,
        JSON.stringify({
          title: resolved.title,
          templateType: resolvedRecord.templateType,
          settings: resolvedRecord.settings,
        }),
        JSON.stringify(resolved.componentTree || []),
        JSON.stringify(resolved.styleSheet || { rules: [] }),
        JSON.stringify(resolved.layoutRegions || {}),
      ],
    );
  } else {
    if (!body.page || !Array.isArray(body.page.componentTree)) {
      return NextResponse.json(
        { error: "A valid Page instance is required" },
        { status: 400 },
      );
    }
    const page = body.page;
    const masterStyleSheet = master.page_config.styleSheet as
      PageStyleSheet | undefined;
    const styleOverrides = createStyleOverrides(
      masterStyleSheet,
      page.styleSheet as PageStyleSheet | undefined,
    );
    const masterLayoutRegions = (master.page_config.layoutRegions ||
      {}) as Record<string, boolean>;
    const layoutOverrides = createLayoutOverrides(
      masterLayoutRegions,
      (page.layoutRegions || {}) as Record<string, boolean>,
    );
    const pageOverrides = { ...page };
    delete pageOverrides.id;
    delete pageOverrides.componentTree;
    delete pageOverrides.styleSheet;
    delete pageOverrides.layoutRegions;
    delete pageOverrides.instance;
    await getCoreDb().query(
      `INSERT INTO public.platform_app_pages
        (app_id,platform_page_id,instance_key,sync_mode,base_master_version,base_master_updated_at,
         page_overrides,component_tree_override,detached_component_tree,style_overrides,layout_overrides)
       VALUES ($1,$2,$3,'FOLLOW_MASTER',$4,$5,$6::jsonb,$7::jsonb,NULL,$8::jsonb,$9::jsonb)
       ON CONFLICT (app_id,platform_page_id) DO UPDATE SET
         page_overrides=EXCLUDED.page_overrides,
         component_tree_override=CASE WHEN platform_app_pages.sync_mode='DETACHED' THEN NULL ELSE EXCLUDED.component_tree_override END,
         detached_component_tree=CASE WHEN platform_app_pages.sync_mode='DETACHED' THEN EXCLUDED.component_tree_override ELSE platform_app_pages.detached_component_tree END,
         style_overrides=EXCLUDED.style_overrides,layout_overrides=EXCLUDED.layout_overrides`,
      [
        appId,
        master.master_id,
        pageId,
        master.master_version,
        master.master_updated_at,
        JSON.stringify(pageOverrides),
        JSON.stringify(
          stripHydratedPageComponentNodes(page.componentTree as ComponentNode[]),
        ),
        JSON.stringify(styleOverrides),
        JSON.stringify(layoutOverrides),
      ],
    );
  }

  const refreshed = await getCoreDb().query<AppPageRow>(selectAppPages, [
    id,
    appId,
  ]);
  const page = refreshed.rows.find((row) => row.page_slug === pageId);
  const [resolvedPage] = page
    ? await hydratePlatformPageComponents(id, [resolvePage(page)])
    : [];
  return NextResponse.json({ page: resolvedPage || null });
}
