import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { dispatchService } from '@/lib/services/dispatcher';
import { serviceFailure, serviceSuccess } from '@/lib/services/http';
import { serviceKeyOf } from '@/lib/services/bindings';
import type { ServiceExecutionContext } from '@/lib/services/runtimeContext';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ bindingId: string; operation: string }> }) {
  const { bindingId, operation } = await context.params; const url = new URL(request.url); const platformId = url.searchParams.get('platformId') || '';
  const auth = await requirePlatformSession(platformId, 'STAFF'); if (auth instanceof NextResponse) return auth;
  let requestId: string | undefined;
  try {
    const result = await getCoreDb().query<{ platform_slug: string; runtime_snapshot: Record<string, any>; runtime_build_revision: string | null }>('SELECT platform_slug,runtime_snapshot,runtime_build_revision FROM public.platforms WHERE id=$1 AND runtime_snapshot IS NOT NULL', [platformId]);
    if (!result.rowCount) return NextResponse.json({ error: 'Published runtime not found' }, { status: 404 });
    const row = result.rows[0]; requestId = randomUUID();
    const ctx: ServiceExecutionContext = { requestId, traceId: request.headers.get('x-trace-id')?.slice(0, 120) || requestId, actor: { type: 'platform-user', userId: auth.sub, roles: [auth.role], permissions: [] }, scope: { platformId, tenantId: platformId, authRealm: 'platform' }, slug: row.platform_slug, publishedRevision: row.runtime_build_revision || 'unversioned', snapshot: row.runtime_snapshot };
    const input = await request.json().catch(() => ({})); const binding = (row.runtime_snapshot.services || []).find((item: any) => item.id === bindingId);
    const dispatched = await dispatchService(ctx, bindingId, operation, input, { idempotencyKey: request.headers.get('idempotency-key') });
    return serviceSuccess(ctx, binding ? serviceKeyOf(binding) : '', binding?.serviceRef?.version || '1.0.0', dispatched, request);
  } catch (error) { return serviceFailure(error, requestId); }
}
