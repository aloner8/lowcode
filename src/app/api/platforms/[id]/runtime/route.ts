import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { dockerAvailable, dockerRequest } from '@/lib/docker/dockerEngine';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { hydratePlatformPageComponents, type HydratablePage } from '@/lib/engine/platformPageComponents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RuntimeRow {
  id: string; platform_slug: string; platform_name: string; master_theme_config: unknown;
  studio_pages: unknown[]; studio_forms: unknown[]; studio_collections: unknown[]; studio_routes: unknown[]; studio_services: unknown[]; studio_initialized: boolean; content_updated_at: Date;
  runtime_path: string | null; runtime_image: string | null; runtime_container_name: string | null;
  runtime_status: string; runtime_built_at: Date | null; runtime_source_updated_at: Date | null;
  runtime_build_revision: string | null; runtime_port: number | null; runtime_error: string | null;
  runtime_surfaces: Record<string, { containerName: string; port: number | null; url: string | null }>;
}

const selectRuntime = `SELECT id, platform_slug, platform_name, master_theme_config,
 COALESCE((SELECT jsonb_agg(pp.page_config || jsonb_build_object(
   'id', pp.page_slug, 'title', pp.title, 'componentTree', pp.component_tree,
   'isDefaultPage', pp.is_entry_page, 'seo', pp.seo
 ) ORDER BY pp.created_at) FROM public.platform_pages pp WHERE pp.platform_id=platforms.id), studio_pages) AS studio_pages,
 studio_forms, studio_collections, studio_routes, studio_services,
 studio_initialized, content_updated_at, runtime_path, runtime_image, runtime_container_name,
 runtime_status, runtime_built_at, runtime_source_updated_at, runtime_build_revision, runtime_port, runtime_error, runtime_surfaces
 FROM public.platforms WHERE id = $1`;

function statusPayload(row: RuntimeRow, dockerConnected: boolean) {
  const stale = !row.runtime_source_updated_at || row.content_updated_at > row.runtime_source_updated_at;
  return {
    dockerConnected,
    exists: Boolean(row.runtime_image && row.runtime_built_at),
    stale,
    status: stale && row.runtime_built_at ? 'stale' : row.runtime_status,
    runtimePath: row.runtime_path || `/platform-runtime/${row.platform_slug}`,
    image: row.runtime_image,
    containerName: row.runtime_container_name,
    buildRevision: row.runtime_build_revision,
    builtAt: row.runtime_built_at?.toISOString() || null,
    sourceUpdatedAt: row.content_updated_at.toISOString(),
    port: row.runtime_port,
    url: row.runtime_port ? `http://localhost:${row.runtime_port}/app/${row.platform_slug}` : null,
    error: row.runtime_error,
    surfaces: row.runtime_surfaces || {},
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const result = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  return NextResponse.json({ runtime: statusPayload(result.rows[0], await dockerAvailable()) });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const result = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  const platform = result.rows[0];
  // Reusable FormComponents are normalized into platform_pages_components and
  // deliberately stripped from platform_pages.component_tree. Runtime must
  // hydrate those instances again before freezing the publish snapshot.
  platform.studio_pages = await hydratePlatformPageComponents(
    id,
    platform.studio_pages as HydratablePage[],
  );
  if (!platform.studio_initialized || !Array.isArray(platform.studio_pages) || platform.studio_pages.length === 0) {
    return NextResponse.json({ error: 'Platform ยังไม่มี Page data สำหรับสร้าง Runtime' }, { status: 409 });
  }
  if (!(await dockerAvailable())) {
    return NextResponse.json({ error: 'Docker Engine ยังไม่พร้อมใช้งาน หรือไม่ได้ mount Docker socket' }, { status: 503 });
  }

  const flowResult = await getCoreDb().query(
    `SELECT route_path AS "routePath", route_label AS "routeLabel", template_type AS "templateType", nodes, edges
     FROM public.platform_page_flows WHERE platform_id=$1 ORDER BY route_path`, [id],
  );
  const snapshot = {
    platformId: platform.id,
    platformSlug: platform.platform_slug,
    platformName: platform.platform_name,
    themeConfig: platform.master_theme_config,
    pages: platform.studio_pages,
    forms: platform.studio_forms || [],
    collections: platform.studio_collections || [],
    routes: platform.studio_routes || [],
    services: platform.studio_services || [],
    flows: flowResult.rows,
    generatedAt: new Date().toISOString(),
  };
  const revision = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 12);
  const repository = `lowcode-platform-${platform.platform_slug}`;
  const image = `${repository}:${revision}`;
  const containerBase = `lowcode_platform_${platform.platform_slug.replace(/-/g, '_')}`;

  try {
    await getCoreDb().query(
      `UPDATE public.platforms SET runtime_status='building', runtime_error=NULL,
         runtime_owner_user_id=$2 WHERE id=$1`,
      [id, auth.sub],
    );
    const tag = await dockerRequest('POST', `/images/${encodeURIComponent(process.env.PLATFORM_RUNTIME_BASE_IMAGE || 'lowcode-app:latest')}/tag?repo=${encodeURIComponent(repository)}&tag=${revision}`);
    if (tag.statusCode >= 300) throw new Error(`Unable to tag runtime image: ${JSON.stringify(tag.data)}`);

    const coreUrl = new URL(process.env.CORE_DATABASE_URL || '');
    coreUrl.pathname = `/platform_${platform.platform_slug.replace(/-/g, '_')}`;
    const routes = Array.isArray(platform.studio_routes) ? platform.studio_routes as Array<{ path?: string; containerName?: string; targetType?: string; targetId?: string; isDefault?: boolean; metadata?: { isStartPoint?: boolean } }> : [];
    const services = Array.isArray(platform.studio_services) ? platform.studio_services as Array<{ id?: string; bundle?: { loginPageId?: string } }> : [];
    const startPathFor = (surface: 'frontend' | 'backend') => {
      const candidates = routes.filter((route) => String(route.containerName || '').endsWith(`-${surface}`));
      const selected = candidates.find((route) => route.isDefault || route.metadata?.isStartPoint) || candidates[0];
      const servicePageId = selected?.targetType === 'service'
        ? services.find((service) => service.id === selected.targetId)?.bundle?.loginPageId
        : undefined;
      const pageId = servicePageId || (selected?.targetType === 'page' ? selected.targetId : undefined);
      if (pageId) return `/${pageId}`;
      const path = selected?.path?.trim() || '/';
      return path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    };
    const surfaces: Record<string, { containerName: string; port: number | null; url: string | null }> = {};
    for (const surface of ['frontend', 'backend'] as const) {
      const containerName = `${containerBase}_${surface}`;
      const existing = await dockerRequest('GET', `/containers/${encodeURIComponent(containerName)}/json`);
      if (existing.statusCode === 200) { await dockerRequest('POST', `/containers/${encodeURIComponent(containerName)}/stop?t=5`); await dockerRequest('DELETE', `/containers/${encodeURIComponent(containerName)}?force=true`); }
      const create = await dockerRequest<{ Id?: string; message?: string }>('POST', `/containers/create?name=${encodeURIComponent(containerName)}`, {
        Image: image, Env: ['PORT=33000', `APP_SURFACE=${surface}`, `PLATFORM_ID=${platform.id}`, `PLATFORM_SLUG=${platform.platform_slug}`, `TENANT_DATABASE_URL=${coreUrl.toString()}`, `CORE_DATABASE_URL=${process.env.CORE_DATABASE_URL || ''}`, 'CORE_DB_SCHEMA=public', `PLATFORM_JWT_SECRET=${process.env.PLATFORM_JWT_SECRET || 'lowcode-local-jwt-secret-change-me'}`],
        ExposedPorts: { '33000/tcp': {} }, HostConfig: { PortBindings: { '33000/tcp': [{ HostPort: '' }] }, NetworkMode: process.env.PLATFORM_RUNTIME_NETWORK || 'lowcode_network' },
      });
      if (create.statusCode >= 300 || !create.data.Id) throw new Error(create.data.message || `Unable to create ${surface} runtime`);
      const start = await dockerRequest('POST', `/containers/${create.data.Id}/start`);
      if (start.statusCode >= 300) throw new Error(`Unable to start ${surface} runtime`);
      const inspect = await dockerRequest<{ NetworkSettings?: { Ports?: Record<string, Array<{ HostPort: string }> | null> } }>('GET', `/containers/${create.data.Id}/json`);
      const surfacePort = Number(inspect.data.NetworkSettings?.Ports?.['33000/tcp']?.[0]?.HostPort || 0) || null;
      const startPath = startPathFor(surface);
      surfaces[surface] = { containerName, port: surfacePort, url: surfacePort ? `http://localhost:${surfacePort}/app/${platform.platform_slug}${startPath}` : null };
    }
    const port = surfaces.frontend.port;

    await getCoreDb().query(`UPDATE public.platforms SET runtime_path=$2, runtime_image=$3,
      runtime_container_name=$4, runtime_status='running', runtime_built_at=NOW(),
      runtime_source_updated_at=content_updated_at, runtime_build_revision=$5,
      runtime_snapshot=$6::jsonb, runtime_port=$7, runtime_surfaces=$8::jsonb, runtime_error=NULL WHERE id=$1`,
      [id, `/platform-runtime/${platform.platform_slug}`, image, containerBase, revision, JSON.stringify(snapshot), port, JSON.stringify(surfaces)]);
    const updated = await getCoreDb().query<RuntimeRow>(selectRuntime, [id]);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'RUNTIME',
      entityId: id,
      action: 'BUILD_RUNTIME',
      performedBy: auth.actor,
      changesSummary: `Build runtime revision ${revision} (image ${image})`,
      snapshotAfter: { revision, image, surfaces },
    });
    return NextResponse.json({ runtime: statusPayload(updated.rows[0], true) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Runtime build failed';
    await getCoreDb().query(`UPDATE public.platforms SET runtime_status='error', runtime_error=$2 WHERE id=$1`, [id, message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
