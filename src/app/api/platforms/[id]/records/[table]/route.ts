import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { insertTenantRecord, listTenantRecords, TenantRecordError } from '@/lib/db/tenantRecords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; table: string }> };

const failure = (error: unknown) => {
  if (error instanceof TenantRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Tenant record operation failed', error);
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการกับข้อมูล Tenant ได้' }, { status: 500 });
};

export async function GET(request: Request, context: Context) {
  const { id, table } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const filters: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith('filter.')) filters[key.slice(7)] = value;
  }

  try {
    const page = await listTenantRecords(id, table, {
      limit: Number(params.get('limit') ?? 50),
      offset: Number(params.get('offset') ?? 0),
      orderBy: params.get('orderBy') ?? undefined,
      direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
      search: params.get('search') ?? undefined,
      filters,
    });
    return NextResponse.json(page);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  const { id, table } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const row = await insertTenantRecord(id, table, body);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'RECORD_INSERT',
      performedBy: auth.actor,
      changesSummary: `เพิ่มข้อมูลในตาราง ${table}`,
      snapshotAfter: row,
    });
    return NextResponse.json({ record: row }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
