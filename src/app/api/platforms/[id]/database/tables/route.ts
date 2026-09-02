import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { describeTenantTableByDatabase, listTenantTablesByDatabase, TenantRecordError } from '@/lib/db/tenantRecords';
import { PlatformDatabaseError, resolvePlatformDatabase } from '@/lib/db/platformDatabases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live tenant schema, read from information_schema — no hard-coded fixtures. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const table = params.get('table');

  try {
    const { database } = await resolvePlatformDatabase(id, params.get('database'));
    if (table) return NextResponse.json({ table: await describeTenantTableByDatabase(database, table), database });
    return NextResponse.json({ tables: await listTenantTablesByDatabase(database), database });
  } catch (error) {
    if (error instanceof PlatformDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TenantRecordError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to read tenant schema', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านโครงสร้าง Tenant Database ได้' }, { status: 500 });
  }
}
