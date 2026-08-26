import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { describeTenantTable, listTenantTables, TenantRecordError } from '@/lib/db/tenantRecords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live tenant schema, read from information_schema — no hard-coded fixtures. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const table = new URL(request.url).searchParams.get('table');

  try {
    if (table) return NextResponse.json({ table: await describeTenantTable(id, table) });
    return NextResponse.json({ tables: await listTenantTables(id) });
  } catch (error) {
    if (error instanceof TenantRecordError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to read tenant schema', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านโครงสร้าง Tenant Database ได้' }, { status: 500 });
  }
}
