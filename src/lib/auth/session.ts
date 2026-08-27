/**
 * Stateless, tamper-proof platform session cookie.
 *
 * The payload is signed with HMAC-SHA256 through the Web Crypto API so the same
 * code runs in the Edge middleware runtime and in Node.js route handlers.
 * A cookie that fails signature or expiry verification is treated as absent.
 */

import type { GlobalRole } from '@/types';

export const SESSION_COOKIE = 'platform_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

const DEV_FALLBACK_SECRET = 'lowcode-dev-only-insecure-session-secret';

/**
 * Secrets that have been published in this repository or its compose file.
 * Anyone can read them, so a deployment using one is not protected at all —
 * they are refused outright rather than merely warned about.
 */
const KNOWN_WEAK_SECRETS = new Set([
  DEV_FALLBACK_SECRET,
  'lowcode-compose-development-secret-change-me',
  'change-me-to-a-long-random-string-at-least-32-chars',
  'dev-secret-at-least-32-characters-long-xxxx',
  'local-dev-secret-please-change-me-0123456789abcdef',
]);

export interface SessionPayload {
  sub: string;
  username: string;
  email: string;
  fullName: string;
  role: GlobalRole;
  mustChangePassword: boolean;
  iat: number;
  exp: number;
}

let warnedAboutFallbackSecret = false;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (secret && KNOWN_WEAK_SECRETS.has(secret)) {
    const message =
      'AUTH_SECRET is set to a publicly known placeholder value. '
      + 'Generate a real one with: openssl rand -base64 48';
    if (isProduction) throw new Error(message);
    if (!warnedAboutFallbackSecret) {
      warnedAboutFallbackSecret = true;
      console.warn(`[auth] ${message}`);
    }
    return secret;
  }

  if (secret && secret.length >= 32) return secret;

  if (isProduction) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters in production');
  }
  if (secret && secret.length > 0) {
    throw new Error('AUTH_SECRET must be at least 32 characters');
  }
  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn('[auth] AUTH_SECRET is not set — using an insecure development secret.');
  }
  return DEV_FALLBACK_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Constant-time comparison so signature checks do not leak timing information. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat: issuedAt, exp: issuedAt + maxAgeSeconds };
  const body = toBase64Url(encoder.encode(JSON.stringify(full)));
  const signature = await crypto.subtle.sign('HMAC', await importKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  try {
    const expected = await crypto.subtle.sign('HMAC', await importKey(), encoder.encode(body));
    if (!timingSafeEqual(new Uint8Array(expected), fromBase64Url(signature))) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    if (!payload.sub || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/**
 * Cookie attributes for the current request.
 *
 * `Secure` must reflect the scheme the browser actually used, not NODE_ENV. A
 * production build served over plain http — which is how the compose stack is
 * exposed locally — would otherwise set a Secure cookie that Safari refuses to
 * store: sign-in appears to succeed, the browser keeps no session, and every
 * page bounces back to the login form.
 *
 * Behind a proxy the scheme arrives in `x-forwarded-proto`.
 */
export function sessionCookieOptionsFor(headers: {
  get(name: string): string | null;
}): typeof BASE_COOKIE_OPTIONS & { secure: boolean } {
  const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isHttps = forwardedProto
    ? forwardedProto === 'https'
    : /^https:/i.test(headers.get('origin') ?? headers.get('referer') ?? '');

  return { ...BASE_COOKIE_OPTIONS, secure: isHttps };
}
