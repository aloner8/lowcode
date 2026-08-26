import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import {
  deleteTenantRecord,
  getTenantRecord,
  TenantRecordError,
  updateTenantRecord,
} from '@/lib/db/tenantRecords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; table: string; recordId: string }> };

const failure = (error: unknown) => {
  if (error instanceof TenantRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Tenant record operation failed', error);
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการกับข้อมูล Tenant ได้' }, { status: 500 });
};

export async function GET(_request: Request, context: Context) {
  const { id, table, recordId } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_VIEWER');
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ record: await getTenantRecord(id, table, recordId) });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  const { id, table, recordId } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_EDITOR', 'DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  try {
    const before = await getTenantRecord(id, table, recordId).catch(() => null);
    const body = (await request.json()) as Record<string, unknown>;
    const row = await updateTenantRecord(id, table, recordId, body);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'RECORD_UPDATE',
      performedBy: auth.actor,
      changesSummary: `แก้ไขข้อมูล ${table} #${recordId}`,
      snapshotBefore: before ?? undefined,
      snapshotAfter: row,
    });
    return NextResponse.json({ record: row });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { id, table, recordId } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_EDITOR', 'DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  try {
    const before = await getTenantRecord(id, table, recordId).catch(() => null);
    await deleteTenantRecord(id, table, recordId);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: id,
      action: 'RECORD_DELETE',
      performedBy: auth.actor,
      changesSummary: `ลบข้อมูล ${table} #${recordId}`,
      snapshotBefore: before ?? undefined,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
