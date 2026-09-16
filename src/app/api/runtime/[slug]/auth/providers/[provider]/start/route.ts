import { NextResponse } from 'next/server';
import { dispatchService } from '@/lib/services/dispatcher';
import { serviceFailure } from '@/lib/services/http';
import { resolveRuntimeContext } from '@/lib/services/runtimeContext';
import { serviceKeyOf } from '@/lib/services/bindings';
import type { StudioServiceDefinition } from '@/types';
import { clientIdentity, enforceRateLimit } from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string; provider: string }> }) {
  const { slug, provider } = await context.params;
  let requestId: string | undefined;
  try {
    if (!['google', 'line', 'facebook', 'entra'].includes(provider)) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    const ctx = await resolveRuntimeContext(request, slug);
    if (!ctx) return NextResponse.json({ error: 'Published runtime not found' }, { status: 404 });
    requestId = ctx.requestId;
    const limited = await enforceRateLimit('tenant_login', clientIdentity(request, `${slug}:${provider}:start`));
    if (limited) return limited;
    const binding = (ctx.snapshot.services || []).find((item: StudioServiceDefinition) => serviceKeyOf(item) === 'auth.session') as StudioServiceDefinition | undefined;
    if (!binding) return NextResponse.json({ error: 'Auth service is not configured' }, { status: 409 });
    const callback = new URL(`/api/runtime/${encodeURIComponent(slug)}/auth/providers/${encodeURIComponent(provider)}/callback`, new URL(request.url).origin).toString();
    const result = await dispatchService(ctx, binding.id, 'startExternalLogin', { provider, redirectUri: callback });
    const authorizationUrl = (result.data as { authorizationUrl?: string }).authorizationUrl;
    if (!authorizationUrl) throw new Error('Provider authorization URL is unavailable');
    return NextResponse.redirect(authorizationUrl, 302);
  } catch (error) {
    return serviceFailure(error, requestId);
  }
}
