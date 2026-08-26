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
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
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

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;
