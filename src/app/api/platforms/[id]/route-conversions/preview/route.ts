import { NextResponse } from 'next/server';
import { convertYiiRoutes } from '@/lib/migration/yii-routes/convertYiiRoutes';
import type { YiiRouteConversionInput } from '@/lib/migration/yii-routes/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as Omit<YiiRouteConversionInput, 'platformId' | 'options'> & { options?: Partial<YiiRouteConversionInput['options']> };
    if (!body.sourceSystemId?.trim() || !body.sqlText?.trim()) return NextResponse.json({ error: 'sourceSystemId and sqlText are required' }, { status: 400 });
    const result = convertYiiRoutes({
      platformId: id, sourceSystemId: body.sourceSystemId.trim(), sqlText: body.sqlText,
      options: { mode: 'dry-run', rulesVersion: body.options?.rulesVersion || 'yii2-react-route-v1', targetContainers: body.options?.targetContainers || { frontend: 'frontend', backend: 'backend' }, preserveLegacyHref: body.options?.preserveLegacyHref !== false, overwriteManualChanges: false },
      mappingOverrides: body.mappingOverrides,
    });
    return NextResponse.json({ conversion: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Route conversion preview failed' }, { status: 500 });
  }
}
