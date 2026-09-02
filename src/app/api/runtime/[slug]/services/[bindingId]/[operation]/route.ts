import { NextResponse } from 'next/server';
import { clientIdentity, enforceRateLimit } from '@/lib/security/rateLimit';
import { dispatchService } from '@/lib/services/dispatcher';
import { serviceKeyOf } from '@/lib/services/bindings';
import { serviceFailure, serviceSuccess } from '@/lib/services/http';
import { resolveRuntimeContext } from '@/lib/services/runtimeContext';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ slug: string; bindingId: string; operation: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug, bindingId, operation } = await context.params; let requestId: string | undefined;
  try {
    const ctx = await resolveRuntimeContext(request, slug); if (!ctx) return NextResponse.json({ ok: false, error: { code: 'SERVICE_NOT_FOUND', message: 'Published runtime was not found', retryable: false } }, { status: 404 }); requestId = ctx.requestId;
    const binding = (ctx.snapshot.services || []).find((item: any) => item.id === bindingId);
    const key = binding ? serviceKeyOf(binding) : '';
    const policy = key === 'auth.session' && operation === 'login' ? 'tenant_login' : operation === 'list' || operation === 'get' || operation === 'count' ? 'public_read' : 'public_write';
    const limited = await enforceRateLimit(policy, clientIdentity(request, `${slug}:${bindingId}:${operation}`)); if (limited) return limited;
    let input: Record<string, any>;
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData(); const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
      input = { files: await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type || 'application/octet-stream', bytes: Buffer.from(await file.arrayBuffer()) }))) };
    } else input = await request.json().catch(() => ({}));
    const result = await dispatchService(ctx, bindingId, operation, input, { idempotencyKey: request.headers.get('idempotency-key') });
    return serviceSuccess(ctx, key, binding?.serviceRef?.version || '1.0.0', result, request);
  } catch (error) { return serviceFailure(error, requestId); }
}
