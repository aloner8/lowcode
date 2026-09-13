import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/apiAuth';
import { getCoreDb } from '@/lib/db/coreDb';
import { fetchPlatformAudit } from '@/lib/engine/AuditLogService';
import type { AuditLogEntityType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit') ?? 100);
  const offset = Number(params.get('offset') ?? 0);
  const entityId = params.get('entityId') ?? undefined;
  if (entityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)) {
    return NextResponse.json({ error: 'entityId ไม่ถูกต้อง' }, { status: 400 });
  }

  try {
    let scope: { scopePlatformIds?: string[]; scopeAppIds?: string[]; scopeActor?: string } = {};
    if (auth.role !== 'GOD') {
      const visible = await getCoreDb().query<{ app_ids: string[]; platform_ids: string[] }>(`
        SELECT COALESCE(ARRAY_AGG(DISTINCT app.id), ARRAY[]::uuid[]) AS app_ids,
               COALESCE(ARRAY_AGG(DISTINCT app.platform_id) FILTER (WHERE app.platform_id IS NOT NULL), ARRAY[]::uuid[]) AS platform_ids
        FROM public.apps app
        WHERE app.owner_user_id = $1 OR EXISTS (
          SELECT 1 FROM public.app_memberships membership
          WHERE membership.app_id = app.id AND membership.user_id = $1
        )
      `, [auth.sub]);
      scope = {
        scopeAppIds: visible.rows[0]?.app_ids ?? [],
        scopePlatformIds: visible.rows[0]?.platform_ids ?? [],
        scopeActor: auth.actor,
      };
    }
    const result = await fetchPlatformAudit({
      ...scope,
      platformId: params.get('platformId') ?? undefined,
      entityId,
      entityType: (params.get('entityType') as AuditLogEntityType | null) ?? undefined,
      action: params.get('action') ?? undefined,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Unable to load audit logs', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่าน Audit Log ได้' }, { status: 500 });
  }
}
