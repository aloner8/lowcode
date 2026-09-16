import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { ServiceError } from './errors';

export type SocialAuthProvider = 'google' | 'line' | 'facebook' | 'entra';

export interface OAuthProviderDefinition {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface ExternalIdentityProfile {
  provider: SocialAuthProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

const PROVIDERS: Record<SocialAuthProvider, OAuthProviderDefinition> = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  line: {
    authorizationUrl: 'https://access.line.me/oauth2/v2.1/authorize',
    tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
    userInfoUrl: 'https://api.line.me/v2/profile',
    scopes: ['openid', 'profile', 'email'],
  },
  facebook: {
    authorizationUrl: 'https://www.facebook.com/v23.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v23.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    scopes: ['email', 'public_profile'],
  },
  entra: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
};

export function oauthProviderDefinition(provider: SocialAuthProvider): OAuthProviderDefinition {
  return PROVIDERS[provider];
}

export function createOAuthStart(provider: SocialAuthProvider, clientId: string, redirectUri: string, definition = PROVIDERS[provider]) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(definition.authorizationUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', definition.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (provider !== 'facebook') url.searchParams.set('nonce', nonce);
  return { authorizationUrl: url.toString(), state, verifier, nonce };
}

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;

export async function exchangeOAuthCode(input: {
  provider: SocialAuthProvider;
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  definition?: OAuthProviderDefinition;
  fetch?: typeof globalThis.fetch;
}): Promise<ExternalIdentityProfile> {
  const definition = input.definition || PROVIDERS[input.provider];
  const fetcher = input.fetch || globalThis.fetch;
  const tokenBody = new URLSearchParams({ grant_type: 'authorization_code', code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, client_secret: input.clientSecret, code_verifier: input.verifier });
  const tokenResponse = await fetcher(definition.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: tokenBody, signal: AbortSignal.timeout(10_000) });
  const tokenPayload = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null;
  const accessToken = text(tokenPayload?.access_token);
  if (!tokenResponse.ok || !accessToken) throw new ServiceError('PROVIDER_AUTH_FAILED', 'The identity provider rejected the authorization code', 401);
  const profileResponse = await fetcher(definition.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  const profile = await profileResponse.json().catch(() => null) as Record<string, unknown> | null;
  if (!profileResponse.ok || !profile) throw new ServiceError('PROVIDER_AUTH_FAILED', 'Unable to read the identity provider profile', 401);
  const subject = text(input.provider === 'line' ? profile.userId : input.provider === 'facebook' ? profile.id : profile.sub);
  if (!subject) throw new ServiceError('PROVIDER_AUTH_FAILED', 'The identity provider profile has no stable subject', 401);
  const email = text(profile.email)?.toLowerCase();
  return {
    provider: input.provider,
    subject,
    email,
    emailVerified: input.provider === 'line' || input.provider === 'facebook' || input.provider === 'entra' ? Boolean(email) : profile.email_verified === true,
    displayName: text(input.provider === 'line' ? profile.displayName : profile.name),
  };
}
