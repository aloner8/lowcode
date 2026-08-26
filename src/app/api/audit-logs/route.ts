import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/apiAuth';
import { fetchPlatformAudit } from '@/lib/engine/AuditLogService';
import type { AuditLogEntityType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiSession('VIEWER');
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit') ?? 100);
  const offset = Number(params.get('offset') ?? 0);

  try {
    const result = await fetchPlatformAudit({
      platformId: params.get('platformId') ?? undefined,
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
