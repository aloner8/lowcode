import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOAuthStart, exchangeOAuthCode, type OAuthProviderDefinition } from '@/lib/services/oauthProviders';
import { createDefaultJwtAuthService } from '@/types';
import { validateBindingSecretReferences } from '@/lib/services/secrets';

afterEach(() => vi.unstubAllEnvs());

describe('federated Auth adapters', () => {
  it('builds state, nonce and an S256 PKCE authorization request', () => {
    const start = createOAuthStart('google', 'client-id', 'https://app.test/callback');
    const url = new URL(start.authorizationUrl);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')).toBe(start.state);
    expect(url.searchParams.get('nonce')).toBe(start.nonce);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).not.toBe(start.verifier);
  });

  it('exchanges a code against a real HTTP socket and maps the stable provider subject', async () => {
    const requests: Array<{ url: string; authorization?: string; body: string }> = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        requests.push({ url: request.url || '', authorization: request.headers.authorization, body: Buffer.concat(chunks).toString() });
        response.setHeader('Content-Type', 'application/json');
        if (request.url === '/token') response.end(JSON.stringify({ access_token: 'provider-access-token', token_type: 'Bearer' }));
        else response.end(JSON.stringify({ sub: 'provider-user-42', email: 'USER@example.test', email_verified: true, name: 'Provider User' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not open a TCP port');
      const base = `http://127.0.0.1:${address.port}`;
      const definition: OAuthProviderDefinition = { authorizationUrl: `${base}/authorize`, tokenUrl: `${base}/token`, userInfoUrl: `${base}/userinfo`, scopes: ['openid'] };
      const profile = await exchangeOAuthCode({ provider: 'google', code: 'one-time-code', verifier: 'pkce-verifier', redirectUri: 'https://app.test/callback', clientId: 'client-id', clientSecret: 'client-secret', definition });
      expect(profile).toEqual({ provider: 'google', subject: 'provider-user-42', email: 'user@example.test', emailVerified: true, displayName: 'Provider User' });
      expect(requests[0].body).toContain('code_verifier=pkce-verifier');
      expect(requests[1].authorization).toBe('Bearer provider-access-token');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('requires protected per-provider client references', () => {
    vi.stubEnv('LOWCODE_CONNECTION_GOOGLE_CLIENT_ID', 'client-id');
    vi.stubEnv('LOWCODE_CONNECTION_GOOGLE_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('PLATFORM_JWT_SECRET', 'signing-secret');
    const auth = createDefaultJwtAuthService('demo');
    auth.config.providers = ['local', 'google'];
    auth.secretRefs = {
      signingKey: 'env://PLATFORM_JWT_SECRET',
      googleClientId: 'env://LOWCODE_CONNECTION_GOOGLE_CLIENT_ID',
      googleClientSecret: 'env://LOWCODE_CONNECTION_GOOGLE_CLIENT_SECRET',
    };
    expect(validateBindingSecretReferences(auth)).toEqual([]);
    auth.secretRefs.googleClientSecret = 'env://GOOGLE_CLIENT_SECRET';
    expect(validateBindingSecretReferences(auth)).toContain("External Auth secret reference 'googleClientSecret' must use the LOWCODE_CONNECTION_ namespace");
  });
});
