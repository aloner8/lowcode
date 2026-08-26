import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { generateSiteMap } from '@/lib/engine/generateSiteMap';
import type { AppRoute } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getCoreDb().query<{ studio_routes: AppRoute[] }>('SELECT studio_routes FROM public.platforms WHERE id=$1', [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  return NextResponse.json({ siteMap: generateSiteMap(Array.isArray(result.rows[0].studio_routes) ? result.rows[0].studio_routes : []) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { routes?: AppRoute[]; action?: string; containerName?: string; nodeType?: AppRoute['targetType']; targetId?: string; label?: string; path?: string; isStartPoint?: boolean };
  if (body.action === 'create-node') {
    if (!body.containerName || !body.nodeType || !body.targetId || !body.label || !body.path) return NextResponse.json({ error: 'containerName, nodeType, targetId, label and path are required' }, { status: 400 });
    const result = await getCoreDb().query<{ studio_routes: AppRoute[] }>('SELECT studio_routes FROM public.platforms WHERE id=$1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    let routes = Array.isArray(result.rows[0].studio_routes) ? result.rows[0].studio_routes : [];
    if (routes.some((route) => route.containerName === body.containerName && route.path === body.path)) return NextResponse.json({ error: `Path '${body.path}' already exists in this container` }, { status: 409 });
    if (body.isStartPoint) routes = routes.map((route) => route.containerName === body.containerName ? { ...route, isDefault: false, metadata: { ...route.metadata, isStartPoint: false } } : route);
    const safeId = `${body.nodeType}.${body.targetId}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const node: AppRoute = { id: `route.node.${safeId}.${Date.now()}`, platformId: id, containerName: body.containerName, path: body.path.startsWith('/') ? body.path : `/${body.path}`, label: body.label, targetType: body.nodeType, targetId: body.targetId, isDefault: Boolean(body.isStartPoint), metadata: { nodeType: body.nodeType, isStartPoint: Boolean(body.isStartPoint), createdFrom: 'site-map-node-manager' } };
    routes = [...routes, node];
    await getCoreDb().query(`UPDATE public.platforms SET studio_routes=$2::jsonb, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(routes)]);
    return NextResponse.json({ routes, node }, { status: 201 });
  }
  if (body.action === 'materialize-legacy-nodes') {
    const result = await getCoreDb().query<{ platform_slug: string; studio_routes: AppRoute[]; studio_pages: Array<{ id: string; name?: string; title?: string; containerName?: string; routePath?: string; isDefaultPage?: boolean; siteMapMaterialized?: boolean }> }>('SELECT platform_slug, studio_routes, studio_pages FROM public.platforms WHERE id=$1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    const platform = result.rows[0];
    const pages = Array.isArray(platform.studio_pages) ? platform.studio_pages : [];
    const existing = Array.isArray(platform.studio_routes) ? platform.studio_routes : [];
    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';
    const normalized = existing.map((route, index) => ({
      ...route,
      id: route.id || `route.legacy.${slug(route.path || route.label || String(index + 1))}`,
      platformId: id,
      containerName: route.containerName || `${platform.platform_slug}-${/admin|backend/i.test(`${route.label} ${route.path}`) ? 'backend' : 'frontend'}`,
      path: route.path || '/',
      label: route.label || route.path || `Node ${index + 1}`,
      targetType: route.targetType || (route.targetId ? 'page' : 'legacy'),
    })) as AppRoute[];
    const pageTargets = new Set(normalized.filter((route) => route.targetType === 'page' && route.targetId).map((route) => route.targetId));
    for (const page of pages) {
      if (pageTargets.has(page.id)) continue;
      const surface = /admin|backend/i.test(`${page.id} ${page.name || ''} ${page.title || ''}`) ? 'backend' : 'frontend';
      normalized.push({ id: `route.page.${slug(page.id)}`, platformId: id, containerName: page.containerName || `${platform.platform_slug}-${surface}`, path: page.routePath || (page.isDefaultPage ? '/' : `/${page.id}`), label: page.title || page.name || page.id, targetType: 'page', targetId: page.id, isDefault: Boolean(page.isDefaultPage), metadata: { materializedFrom: 'legacy-studio-page' } });
    }
    const materializedPages = pages.map((page) => ({ ...page, siteMapMaterialized: true }));
    await getCoreDb().query(`UPDATE public.platforms SET studio_routes=$2::jsonb, studio_pages=$3::jsonb, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(normalized), JSON.stringify(materializedPages)]);
    return NextResponse.json({ routes: normalized, pages: materializedPages, materialized: normalized.length });
  }
  if (!Array.isArray(body.routes)) return NextResponse.json({ error: 'routes must be an array' }, { status: 400 });
  return NextResponse.json({ siteMap: generateSiteMap(body.routes.map((route) => ({ ...route, platformId: id }))) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const routeId = new URL(request.url).searchParams.get('routeId');
  if (routeId) {
    const current = await getCoreDb().query<{ studio_routes: AppRoute[] }>('SELECT studio_routes FROM public.platforms WHERE id=$1', [id]);
    if (!current.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    const routes = Array.isArray(current.rows[0].studio_routes) ? current.rows[0].studio_routes : [];
    if (!routes.some((route) => route.id === routeId)) return NextResponse.json({ error: 'Site Map node not found' }, { status: 404 });
    const nextRoutes = routes.filter((route) => route.id !== routeId);
    await getCoreDb().query(
      `UPDATE public.platforms SET studio_routes=$2::jsonb, content_updated_at=NOW(),
       runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`,
      [id, JSON.stringify(nextRoutes)],
    );
    return NextResponse.json({ routes: nextRoutes, deletedRouteId: routeId });
  }
  const result = await getCoreDb().query(
    `UPDATE public.platforms SET studio_routes='[]'::jsonb, content_updated_at=NOW(),
     runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END
     WHERE id=$1 RETURNING id`,
    [id],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  return NextResponse.json({ routes: [], deleted: true });
}
