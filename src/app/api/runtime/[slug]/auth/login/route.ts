import { NextResponse } from 'next/server';
import { clientIdentity, enforceRateLimit, rateLimitReset } from '@/lib/security/rateLimit';
import { dispatchService } from '@/lib/services/dispatcher';
import { serviceFailure } from '@/lib/services/http';
import { resolveRuntimeContext, tenantRefreshCookieName, tenantSessionCookieName } from '@/lib/services/runtimeContext';
import { serviceKeyOf } from '@/lib/services/bindings';
import type { StudioServiceDefinition } from '@/types';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

/** Backward-compatible alias. New components use /services/{bindingId}/login. */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params; let requestId: string | undefined;
  try {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
    const identity = clientIdentity(request, `${slug}:${body.email || ''}`);
    const limited = await enforceRateLimit('tenant_login', identity); if (limited) return limited;
    const ctx = await resolveRuntimeContext(request, slug); if (!ctx) return NextResponse.json({ error: 'Published runtime not found' }, { status: 404 }); requestId = ctx.requestId;
    const authBinding = (ctx.snapshot.services || []).find((item: StudioServiceDefinition) => serviceKeyOf(item) === 'auth.session') as StudioServiceDefinition | undefined;
    if (!authBinding) return NextResponse.json({ error: 'Auth service is not configured' }, { status: 409 });
    const result = await dispatchService(ctx, authBinding.id, 'login', body); await rateLimitReset('tenant_login', identity);
    const data = result.data as Record<string, unknown>; const response = NextResponse.json(data);
    if (result.token) response.cookies.set(tenantSessionCookieName(slug), result.token, { httpOnly: true, sameSite: 'lax', secure: request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:', path: '/', maxAge: result.maxAge || 900 });
    if (result.refreshToken) response.cookies.set(tenantRefreshCookieName(slug), result.refreshToken, { httpOnly: true, sameSite: 'strict', secure: request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:', path: '/', maxAge: result.refreshMaxAge || 604800 });
    response.headers.set('X-Request-Id', ctx.requestId); return response;
  } catch (error) {
    const response = serviceFailure(error, requestId); const payload = await response.json() as { error?: { message?: string; code?: string } };
    return NextResponse.json({ error: payload.error?.message || 'Login failed', code: payload.error?.code }, { status: response.status, headers: requestId ? { 'X-Request-Id': requestId } : undefined });
  }
}
