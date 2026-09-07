import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { getCoreDb } from '@/lib/db/coreDb';
import { clientIdentity, enforceRateLimit } from '@/lib/security/rateLimit';
import { resolveRuntimeContext, type ServiceExecutionContext } from './runtimeContext';
import { dispatchModule } from './moduleFacade';
import { serviceFailure, serviceSuccess } from './http';
import { ServiceError } from './errors';

export async function handleModuleRequest(request: Request, module: string, operation: string, slug?: string) {
  let requestId: string | undefined;
  try {
    // Browsers must not perform cross-origin authenticated actions with cookies.
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ServiceError('PERMISSION_DENIED', 'Cross-origin module requests are not allowed', 403);
    let ctx: ServiceExecutionContext | null;
    const runtimeSlug = process.env.SITE_SLUG?.trim();
    if (runtimeSlug && slug && runtimeSlug !== slug) throw new ServiceError('PERMISSION_DENIED', 'This runtime belongs to another app', 403);
    const selectedSlug = runtimeSlug || slug;
    if (selectedSlug) ctx = await resolveRuntimeContext(request, selectedSlug);
    else {
      const platformId = new URL(request.url).searchParams.get('platformId') || '';
      if (!platformId) throw new ServiceError('SERVICE_INPUT_INVALID', 'The application shell must select a platform', 400);
      const auth = await requirePlatformSession(platformId, 'STAFF');
      if (auth instanceof NextResponse) return auth;
      const row = (await getCoreDb().query('SELECT platform_slug,runtime_snapshot,runtime_build_revision FROM public.platforms WHERE id=$1 AND runtime_snapshot IS NOT NULL', [platformId])).rows[0];
      ctx = row ? { requestId: randomUUID(), traceId: randomUUID(), actor: { type: 'platform-user', userId: auth.sub, roles: [auth.role], permissions: [] }, scope: { platformId, tenantId: platformId, authRealm: 'platform' }, slug: row.platform_slug, publishedRevision: row.runtime_build_revision || 'unversioned', snapshot: row.runtime_snapshot } : null;
    }
    if (!ctx) throw new ServiceError('SERVICE_NOT_FOUND', 'Published runtime not found', 404);
    requestId = ctx.requestId;
    const policy = module === 'auth' && operation === 'login' ? 'tenant_login' : 'public_write';
    const limited = await enforceRateLimit(policy, clientIdentity(request, `${ctx.slug}:${module}:${operation}`));
    if (limited) return limited;
    const input: unknown = await request.json().catch(() => { throw new ServiceError('SERVICE_INPUT_INVALID', 'Request body must be JSON', 400); });
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ServiceError('SERVICE_INPUT_INVALID', 'Request body must be an object', 400);
    const dispatched = await dispatchModule(ctx, module, operation, input as Record<string, unknown>, { idempotencyKey: request.headers.get('idempotency-key') });
    return serviceSuccess(ctx, dispatched.serviceKey, dispatched.version, dispatched.result, request);
  } catch (error) { return serviceFailure(error, requestId); }
}
