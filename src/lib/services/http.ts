import { NextResponse } from 'next/server';
import { ServiceError } from './errors';
import type { DispatchResult } from './dispatcher';
import { tenantRefreshCookieName, tenantSessionCookieName, type ServiceExecutionContext } from './runtimeContext';

export function serviceSuccess(ctx: ServiceExecutionContext, service: string, version: string, result: DispatchResult, request?: Request) {
  const response = NextResponse.json({ ok: true, data: result.data, meta: { requestId: ctx.requestId, service, version, replayed: result.replayed || undefined } });
  const secure = Boolean(request && (request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' || new URL(request.url).protocol === 'https:'));
  const cookieName = tenantSessionCookieName(ctx.slug);
  if (result.clearCookie) {
    response.cookies.set(cookieName, '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
    response.cookies.set(tenantRefreshCookieName(ctx.slug), '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });
  } else {
    if (result.token) response.cookies.set(cookieName, result.token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: result.maxAge || 900 });
    if (result.refreshToken) response.cookies.set(tenantRefreshCookieName(ctx.slug), result.refreshToken, { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: result.refreshMaxAge || 604800 });
  }
  response.headers.set('X-Request-Id', ctx.requestId);
  return response;
}

export function serviceFailure(error: unknown, requestId?: string) {
  const known = error instanceof ServiceError; const value = known ? error : new ServiceError('INTERNAL_ERROR', 'Service execution failed', 500);
  if (!known) console.error('[shared-service] unhandled error', error);
  return NextResponse.json({ ok: false, error: { code: value.code, message: value.message, fieldErrors: value.fieldErrors, retryable: value.retryable }, meta: { requestId } }, { status: value.status, headers: requestId ? { 'X-Request-Id': requestId } : undefined });
}
