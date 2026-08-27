import { NextResponse } from 'next/server';
import { requireGod } from '@/lib/auth/apiAuth';
import { getCoreDb } from '@/lib/db/coreDb';
import { convertYiiRoutes } from '@/lib/migration/yii-routes/convertYiiRoutes';
import { applyMenuPatchesToPages, mergeConvertedRoutes } from '@/lib/migration/yii-routes/applyConversion';
import type { YiiRouteConversionInput } from '@/lib/migration/yii-routes/types';
import type { AppRoute, ComponentNode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlatformRow { studio_routes: AppRoute[]; studio_pages: Array<{ componentTree?: ComponentNode[] }>; }

/**
 * Control-plane endpoints: they read and rewrite the routes and pages of a
 * platform, so every method is restricted to หนุมานไอที staff. They shipped with
 * no check at all — an anonymous caller could read a platform's whole site map
 * and write routes into it.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const client = await getCoreDb().connect();
  try {
    const { id } = await context.params;
    const body = await request.json() as Omit<YiiRouteConversionInput, 'platformId' | 'options'> & { previewFingerprint?: string; options?: Partial<YiiRouteConversionInput['options']> };
    if (!body.sourceSystemId?.trim() || !body.sqlText?.trim() || !body.previewFingerprint) return NextResponse.json({ error: 'sourceSystemId, sqlText and previewFingerprint are required' }, { status: 400 });
    const input: YiiRouteConversionInput = { platformId: id, sourceSystemId: body.sourceSystemId.trim(), sqlText: body.sqlText, options: { mode: 'apply', rulesVersion: body.options?.rulesVersion || 'yii2-react-route-v1', targetContainers: body.options?.targetContainers || { frontend: 'frontend', backend: 'backend' }, preserveLegacyHref: body.options?.preserveLegacyHref !== false, overwriteManualChanges: false }, mappingOverrides: body.mappingOverrides };
    const conversion = convertYiiRoutes(input);
    if (conversion.sourceFingerprint !== body.previewFingerprint) return NextResponse.json({ error: 'Source changed after preview; run preview again' }, { status: 409 });
    if (conversion.issues.some((issue) => issue.severity === 'error')) return NextResponse.json({ error: 'Conversion has blocking issues', conversion }, { status: 422 });
    await client.query('BEGIN');
    const platform = await client.query<PlatformRow>('SELECT studio_routes, studio_pages FROM public.platforms WHERE id=$1 FOR UPDATE', [id]);
    if (!platform.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Platform not found' }, { status: 404 }); }
    const current = platform.rows[0];
    const merged = mergeConvertedRoutes(Array.isArray(current.studio_routes) ? current.studio_routes : [], conversion.routes);
    const pages = applyMenuPatchesToPages(Array.isArray(current.studio_pages) ? current.studio_pages : [], conversion.menuPatches, input.options.preserveLegacyHref !== false);
    conversion.status = 'applied'; conversion.summary = { ...conversion.summary, created: merged.created, updated: merged.updated, unchanged: merged.unchanged };
    await client.query(`UPDATE public.platforms SET studio_routes=$2::jsonb, studio_pages=$3::jsonb, content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`, [id, JSON.stringify(merged.routes), JSON.stringify(pages)]);
    await client.query(`INSERT INTO public.platform_route_conversions (id, platform_id, source_system_id, source_fingerprint, rules_version, status, result, applied_at) VALUES ($1,$2,$3,$4,$5,'applied',$6::jsonb,NOW()) ON CONFLICT (id) DO UPDATE SET status='applied', result=EXCLUDED.result, applied_at=NOW()`, [conversion.conversionId, id, input.sourceSystemId, conversion.sourceFingerprint, input.options.rulesVersion, JSON.stringify(conversion)]);
    await client.query('COMMIT');
    return NextResponse.json({ conversion });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Route conversion apply failed';
    return NextResponse.json({ error: /studio_routes|platform_route_conversions/.test(message) ? 'Route migration 008 has not been applied' : message }, { status: 500 });
  } finally { client.release(); }
}
