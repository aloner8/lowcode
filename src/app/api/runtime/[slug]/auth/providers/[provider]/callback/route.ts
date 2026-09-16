import { NextResponse } from 'next/server';
import { dispatchService } from '@/lib/services/dispatcher';
import { serviceFailure } from '@/lib/services/http';
import { resolveRuntimeContext, tenantRefreshCookieName, tenantSessionCookieName } from '@/lib/services/runtimeContext';
import { serviceKeyOf } from '@/lib/services/bindings';
import type { StudioServiceDefinition } from '@/types';
import { clientIdentity, enforceRateLimit } from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string; provider: string }> }) {
  const { slug, provider } = await context.params;
  let requestId: string | undefined;
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    if (!['google', 'line', 'facebook', 'entra'].includes(provider) || !code || !state) return NextResponse.json({ error: 'Invalid provider callback' }, { status: 400 });
    const ctx = await resolveRuntimeContext(request, slug);
    if (!ctx) return NextResponse.json({ error: 'Published runtime not found' }, { status: 404 });
    requestId = ctx.requestId;
    const limited = await enforceRateLimit('tenant_login', clientIdentity(request, `${slug}:${provider}:callback`));
    if (limited) return limited;
    const binding = (ctx.snapshot.services || []).find((item: StudioServiceDefinition) => serviceKeyOf(item) === 'auth.session') as StudioServiceDefinition | undefined;
    if (!binding) return NextResponse.json({ error: 'Auth service is not configured' }, { status: 409 });
    const redirectUri = new URL(`/api/runtime/${encodeURIComponent(slug)}/auth/providers/${encodeURIComponent(provider)}/callback`, url.origin).toString();
    const result = await dispatchService(ctx, binding.id, 'completeExternalLogin', { provider, code, state, redirectUri });
    const redirectPath = String((result.data as { redirectPath?: string }).redirectPath || '/');
    const target = new URL(redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/', url.origin);
    const response = NextResponse.redirect(target, 303);
    const secure = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' || url.protocol === 'https:';
    if (result.token) response.cookies.set(tenantSessionCookieName(slug), result.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: result.maxAge || 900 });
    if (result.refreshToken) response.cookies.set(tenantRefreshCookieName(slug), result.refreshToken, { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: result.refreshMaxAge || 604800 });
    response.headers.set('X-Request-Id', ctx.requestId);
    return response;
  } catch (error) {
    return serviceFailure(error, requestId);
  }
}
