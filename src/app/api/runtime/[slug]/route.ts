import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { mergePlatformMasterWithTenantOverrides } from '@/lib/engine/PlatformMergeEngine';
import type { ComponentNode, TenantOverrides, ThemeConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RuntimeSnapshot {
  platformId: string;
  platformSlug: string;
  platformName: string;
  themeConfig: ThemeConfig;
  pages?: Array<{ id: string; title?: string; componentTree?: ComponentNode[] }>;
  forms?: unknown[];
  collections?: unknown[];
  routes?: Array<Record<string, any>>;
  services?: Array<Record<string, any>>;
  flows?: unknown[];
  generatedAt: string;
}

interface SnapshotRow {
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

/**
 * Runtime payload for a published site.
 *
 * `slug` resolves as a Tenant App first — so the master layout is merged with
 * that tenant's overrides (PlatformModule.MD §3) — and falls back to the
 * Platform Master itself when no app owns the slug.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const result = await getCoreDb().query<SnapshotRow>(
    `SELECT p.runtime_snapshot, p.platform_slug,
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
    return NextResponse.json({ error: 'Published runtime snapshot not found' }, { status: 404 });
  }

  const row = result.rows[0];
  const snapshot = row.runtime_snapshot;
  const surface = process.env.APP_SURFACE || 'frontend';

  // Routes and services decide the entry page (dev: service/route driven start
  // point); tenant overrides then shape what that page actually renders.
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const services = Array.isArray(snapshot.services) ? snapshot.services : [];
  const surfaceRoutes = routes.filter((item) => String(item.containerName || '').endsWith(`-${surface}`));
  const startRoute = surfaceRoutes.find((item) => item.isDefault || item.metadata?.isStartPoint)
    || routes.find((item) => (item.isDefault || item.metadata?.isStartPoint) && item.targetType === 'service');
  const startService = startRoute?.targetType === 'service'
    ? services.find((item) => item.id === startRoute.targetId)
    : undefined;
  const startPageId = startService?.bundle?.loginPageId
    || (startRoute?.targetType === 'page' ? startRoute.targetId : undefined);

  const page =
    snapshot.pages?.find((item) => item.id === startPageId) ||
    snapshot.pages?.find((item) => item.id === (surface === 'backend' ? 'admin' : 'index')) ||
    snapshot.pages?.find((item) => item.id === 'index') ||
    snapshot.pages?.[0];

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
      port: row.app_port ?? Number(process.env.PORT || 33000),
      subdomain: row.app_subdomain ?? `${snapshot.platformSlug}.localhost`,
      tenantDbName:
        row.tenant_db_name ?? `platform_${String(snapshot.platformSlug).replace(/-/g, '_')}`,
      platformId: snapshot.platformId,
      inheritedFrom: isTenantApp ? snapshot.platformName : undefined,
      themeConfig,
      createdAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
    },
    pageLayout: {
      id: `${snapshot.platformId}:${page?.id ?? 'index'}`,
      appId: snapshot.platformId,
      pageSlug: page?.id || 'index',
      title: page?.title || 'Home',
      isDefaultPage: true,
      componentTree,
      createdAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
    },
    forms: snapshot.forms || [],
    collections: snapshot.collections || [],
    routes: snapshot.routes || [],
    pages: snapshot.pages || [],
    services,
    flows: snapshot.flows || [],
  });
}
