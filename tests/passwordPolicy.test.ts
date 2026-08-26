import { beforeAll, describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/auth/session';

const base = {
  sub: '11111111-1111-1111-1111-111111111111',
  username: 'admin',
  email: 'admin@example.com',
  fullName: 'Admin',
  role: 'GOD' as const,
};

beforeAll(() => {
  process.env.AUTH_SECRET = 'c'.repeat(48);
});

describe('must-change-password claim', () => {
  it('survives a signing round-trip', async () => {
    const token = await signSession({ ...base, mustChangePassword: true });
    expect((await verifySession(token))?.mustChangePassword).toBe(true);
  });

  it('is cleared when a fresh session is issued', async () => {
    const token = await signSession({ ...base, mustChangePassword: false });
    expect((await verifySession(token))?.mustChangePassword).toBe(false);
  });

  it('cannot be flipped by editing the cookie', async () => {
    const token = await signSession({ ...base, mustChangePassword: true });
    const [body, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...decoded, mustChangePassword: false })).toString('base64url');
    expect(await verifySession(`${forged}.${signature}`)).toBeNull();
  });
});

describe('publicly known secrets are refused', () => {
  it('rejects the compose placeholder in production', async () => {
    const previousSecret = process.env.AUTH_SECRET;
    const previousEnv = process.env.NODE_ENV;
    process.env.AUTH_SECRET = 'lowcode-compose-development-secret-change-me';
    // @ts-expect-error NODE_ENV is writable in tests
    process.env.NODE_ENV = 'production';

    await expect(signSession({ ...base, mustChangePassword: false })).rejects.toThrow(/placeholder/i);

    process.env.AUTH_SECRET = previousSecret;
    // @ts-expect-error NODE_ENV is writable in tests
    process.env.NODE_ENV = previousEnv;
  });

  it('rejects a secret that is too short in production', async () => {
    const previousSecret = process.env.AUTH_SECRET;
    const previousEnv = process.env.NODE_ENV;
    process.env.AUTH_SECRET = 'short';
    // @ts-expect-error NODE_ENV is writable in tests
    process.env.NODE_ENV = 'production';

    await expect(signSession({ ...base, mustChangePassword: false })).rejects.toThrow(/32 characters/);

    process.env.AUTH_SECRET = previousSecret;
    // @ts-expect-error NODE_ENV is writable in tests
    process.env.NODE_ENV = previousEnv;
  });
});
