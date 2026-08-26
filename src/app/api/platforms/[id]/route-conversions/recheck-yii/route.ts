import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getCoreDb } from '@/lib/db/coreDb';
import { attachYiiOutline, recheckYiiRouteTargets } from '@/lib/migration/yii-routes/recheckYiiTargets';
import type { AppRoute } from '@/types';
import type { StudioCollectionDefinition, StudioFormDefinition } from '@/lib/studio/backendFormDefinitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlatformRow {
  studio_routes: AppRoute[];
  studio_forms: StudioFormDefinition[];
  studio_collections: StudioCollectionDefinition[];
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await getCoreDb().connect();
  try {
    const { id } = await context.params;
    await client.query('BEGIN');
    const result = await client.query<PlatformRow>('SELECT studio_routes, studio_forms, studio_collections FROM public.platforms WHERE id=$1 FOR UPDATE', [id]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }
    const platform = result.rows[0];
    const routes = Array.isArray(platform.studio_routes) ? platform.studio_routes : [];
    let outlinedRoutes = routes;
    try {
      const sqlText = readFileSync(path.join(process.cwd(), 'public', 'YII', 'yang.sql'), 'utf8');
      outlinedRoutes = attachYiiOutline(routes, sqlText);
    } catch { /* ReCheck still resolves files when the optional local dump is absent. */ }
    const checked = recheckYiiRouteTargets(outlinedRoutes);
    const existingForms = Array.isArray(platform.studio_forms) ? platform.studio_forms : [];
    const existingCollections = Array.isArray(platform.studio_collections) ? platform.studio_collections : [];
    const formIds = new Set(existingForms.map((item) => item.id));
    const collectionIds = new Set(existingCollections.map((item) => item.id));
    const addedForms = checked.formsToAdd.filter((item) => !formIds.has(item.id));
    const addedCollections = checked.collectionsToAdd.filter((item) => !collectionIds.has(item.id));
    const studioForms = [...existingForms, ...addedForms];
    const studioCollections = [...existingCollections, ...addedCollections];
    await client.query(
      `UPDATE public.platforms SET studio_routes=$2::jsonb, studio_forms=$3::jsonb, studio_collections=$4::jsonb,
       content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`,
      [id, JSON.stringify(checked.updatedRoutes), JSON.stringify(studioForms), JSON.stringify(studioCollections)],
    );
    await client.query('COMMIT');
    const matched = checked.matches.filter((item) => item.status === 'matched').length;
    return NextResponse.json({
      routes: checked.updatedRoutes,
      summary: { checked: checked.matches.length, matched, unresolved: checked.matches.filter((item) => item.status === 'missing-view' || item.status === 'missing-definition').length, formsAdded: addedForms.length, collectionsAdded: addedCollections.length },
      matches: checked.matches,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ReCheckYII failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
