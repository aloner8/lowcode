import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { generateRoutesFromCollections, type RouteCollectionSource } from '@/lib/engine/generateRoutesFromCollections';
import { mergeConvertedRoutes } from '@/lib/migration/yii-routes/applyConversion';
import type { AppRoute } from '@/types';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

interface Row { studio_collections: RouteCollectionSource[]; studio_routes: AppRoute[]; platform_slug: string; }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { collectionIds?: string[]; containerName?: string; apply?: boolean };
  if (!Array.isArray(body.collectionIds) || !body.collectionIds.length) return NextResponse.json({ error: 'Select at least one collection' }, { status: 400 });
  const result = await getCoreDb().query<Row>('SELECT platform_slug, studio_collections, studio_routes FROM public.platforms WHERE id=$1', [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  const row = result.rows[0]; const ids = new Set(body.collectionIds);
  const selected = (row.studio_collections || []).filter((item) => ids.has(item.id));
  if (selected.length !== ids.size) return NextResponse.json({ error: 'One or more collections do not exist in this project' }, { status: 400 });
  const routes = generateRoutesFromCollections({ platformId: id, containerName: body.containerName || `${row.platform_slug}-backend`, collections: selected });
  const merged = mergeConvertedRoutes(Array.isArray(row.studio_routes) ? row.studio_routes : [], routes);
  if (body.apply) await getCoreDb().query(`UPDATE public.platforms SET studio_routes=$2::jsonb, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(merged.routes)]);
  return NextResponse.json({ preview: !body.apply, applied: Boolean(body.apply), routes, summary: { selected: selected.length, created: merged.created, updated: merged.updated, unchanged: merged.unchanged } });
}
