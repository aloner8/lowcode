import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { resolvePlatformDatabase, PlatformDatabaseError } from '@/lib/db/platformDatabases';
import { createOrReplaceCollectionProcedure, type ProcedureOperation } from '@/lib/db/collectionProcedure';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const text = (value: unknown, max = 160) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const database = text(body.database);
    const table = text(body.table);
    const collectionId = text(body.collectionId, 64);
    const rawOperation = body.operation && typeof body.operation === 'object' ? body.operation as Record<string, unknown> : {};
    const method = text(rawOperation.method, 10) as ProcedureOperation['method'];
    const operation: ProcedureOperation = {
      id: text(rawOperation.id, 80),
      method,
      procedure: text(rawOperation.procedure),
    };
    if (!database || !table || !operation.id || !operation.procedure || !['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
      return NextResponse.json({ error: 'database, table, and a valid operation are required' }, { status: 400 });
    }
    const target = await resolvePlatformDatabase(id, database);
    const result = await createOrReplaceCollectionProcedure(target.pool, table, operation);
    await recordPlatformAudit({
      platformId: id,
      entityType: 'DATABASE',
      entityId: collectionId || null,
      action: 'CREATE_PROCEDURE',
      performedBy: auth.actor,
      changesSummary: `Create or replace procedure ${result.procedure} in ${target.database} for operation ${operation.id}`,
      snapshotAfter: { database: target.database, table, operation: operation.id, method, signature: result.signature },
    });
    return NextResponse.json({ ...result, database: target.database });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create procedure';
    if (error instanceof PlatformDatabaseError) return NextResponse.json({ error: message }, { status: error.status });
    console.error('Unable to create collection procedure', error);
    return NextResponse.json({ error: message }, { status: /required|must use|not found|requires|no columns/i.test(message) ? 400 : 500 });
  }
}
