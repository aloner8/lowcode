import { beforeAll, describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/auth/session';

const payload = {
  sub: '11111111-1111-1111-1111-111111111111',
  username: 'admin',
  email: 'admin@example.com',
  fullName: 'Admin',
  role: 'GOD' as const,
  mustChangePassword: false,
};

beforeAll(() => {
  process.env.AUTH_SECRET = 'a'.repeat(48);
});

describe('session cookie', () => {
  it('round-trips a signed payload', async () => {
    const token = await signSession(payload);
    const verified = await verifySession(token);
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.role).toBe('GOD');
  });

  it('rejects a payload whose body was tampered with', async () => {
    const token = await signSession(payload);
    const [body, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, role: 'GOD', iat: 1, exp: 2 ** 32 }),
    ).toString('base64url');
    expect(body).not.toBe(forged);
    expect(await verifySession(`${forged}.${signature}`)).toBeNull();
  });

  it('rejects a token with a broken signature', async () => {
    const token = await signSession(payload);
    expect(await verifySession(`${token.slice(0, -2)}xy`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSession(payload, -10);
    expect(await verifySession(token)).toBeNull();
  });

  it('rejects malformed and empty input', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('not-a-token')).toBeNull();
    expect(await verifySession('.abc')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(payload);
    process.env.AUTH_SECRET = 'b'.repeat(48);
    const verified = await verifySession(token);
    process.env.AUTH_SECRET = 'a'.repeat(48);
    expect(verified).toBeNull();
  });
});
