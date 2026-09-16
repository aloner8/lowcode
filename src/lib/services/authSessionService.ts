import 'server-only';
import { randomBytes } from 'node:crypto';
import { getAppTenantDb, getTenantDb } from '@/lib/db/tenantDb';
import { issueJwt, type JwtServiceConfig } from './jwtAuthService';
import { resolveSecretReference } from './secrets';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';
import { consumeOAuthState, ensureFederatedAuthSchema, storeOAuthState } from './authFederationStore';
import { createOAuthStart, exchangeOAuthCode, type ExternalIdentityProfile, type SocialAuthProvider } from './oauthProviders';
import { authenticateDirectory, type DirectoryIdentityProfile, type DirectoryProvider } from './directoryAuth';

interface AuthUserRow {
  id: string;
  username: string | null;
  email: string;
  display_name: string | null;
  role_name: string | null;
  permissions: string[];
  session_version: number;
}

const authConfig = (ctx: ServiceExecutionContext, binding: StudioServiceDefinition): JwtServiceConfig => ({
  algorithm: 'HS256', issuer: String(binding.config.issuer || ctx.slug), audience: String(binding.config.audience || `${ctx.slug}-runtime`),
  accessTokenTtlSeconds: Number(binding.config.accessTokenTtlSeconds || 900), secretEnvKey: String(binding.config.secretEnvKey || 'PLATFORM_JWT_SECRET'),
});
const dbFor = async (ctx: ServiceExecutionContext) => ctx.scope.appId ? getAppTenantDb(ctx.scope.appId) : getTenantDb(ctx.scope.platformId);
const providersFor = (binding: StudioServiceDefinition) => Array.isArray(binding.config.providers) ? binding.config.providers.map(String) : ['local'];

function sessionResult(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, user: AuthUserRow) {
  const config = authConfig(ctx, binding);
  const secret = resolveSecretReference(binding.secretRefs?.signingKey || `env://${config.secretEnvKey}`);
  const roles = user.role_name ? [user.role_name] : [];
  const actor = { id: user.id, username: user.username, email: user.email, displayName: user.display_name, roles, permissions: user.permissions };
  const claims = { sub: user.id, email: user.email, roles, permissions: user.permissions, sessionVersion: user.session_version };
  const token = issueJwt({ ...claims, tokenUse: 'access' }, config, secret);
  const refreshMaxAge = Number(binding.config.refreshTokenTtlSeconds || 604800);
  const refreshToken = issueJwt({ ...claims, tokenUse: 'refresh' }, { ...config, accessTokenTtlSeconds: refreshMaxAge }, secret);
  return { data: { token, user: actor, successPageId: binding.bundle?.adminPageId, redirectPath: String(binding.config.afterLogin || '/') }, token, refreshToken, maxAge: config.accessTokenTtlSeconds, refreshMaxAge };
}

async function loadUser(pool: Awaited<ReturnType<typeof dbFor>>['pool'], userId: string): Promise<AuthUserRow | null> {
  const result = await pool.query<AuthUserRow>(
    `SELECT u.id::text,u.username,u.email,u.display_name,r.name AS role_name,u.session_version,
            COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions
     FROM public.auth_users u LEFT JOIN public.auth_roles r ON r.id=u.role_id
     LEFT JOIN public.auth_role_permissions rp ON rp.role_id=r.id
     LEFT JOIN public.auth_permissions p ON p.id=rp.permission_id
     WHERE u.id=$1 AND u.is_active=true GROUP BY u.id,u.username,u.email,u.display_name,r.name,u.session_version`, [userId],
  );
  return result.rows[0] || null;
}

async function externalUser(pool: Awaited<ReturnType<typeof dbFor>>['pool'], binding: StudioServiceDefinition, profile: ExternalIdentityProfile | DirectoryIdentityProfile): Promise<AuthUserRow> {
  const linked = await pool.query<{ user_id: string }>('SELECT user_id::text FROM sys.auth_external_identities WHERE provider=$1 AND subject=$2', [profile.provider, profile.subject]);
  let user = linked.rowCount ? await loadUser(pool, linked.rows[0].user_id) : null;
  if (!user) {
    if (!binding.config.allowRegister) throw new ServiceError('REGISTRATION_DISABLED', 'This external identity is not provisioned for the app', 403);
    const email = profile.emailVerified && profile.email ? profile.email : `${profile.provider}-${Buffer.from(profile.subject).toString('base64url').slice(0, 32)}@external.invalid`;
    const username = `${profile.provider}_${Buffer.from(profile.subject).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, 72)}`.toLowerCase();
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO public.auth_users(username,email,password_hash,display_name,is_active,role_id)
       VALUES($1,$2,crypt($3,gen_salt('bf')),$4,true,(SELECT id FROM public.auth_roles WHERE name='member' LIMIT 1))
       ON CONFLICT(email) DO NOTHING RETURNING id::text`,
      [username, email, randomBytes(48).toString('base64url'), profile.displayName || email],
    );
    if (!inserted.rowCount) throw new ServiceError('IDENTITY_LINK_REQUIRED', 'A local account already uses this email; verify and link it from the account profile', 409);
    await pool.query(
      `INSERT INTO sys.auth_external_identities(provider,subject,user_id,email,profile)
       VALUES($1,$2,$3,$4,$5::jsonb)`,
      [profile.provider, profile.subject, inserted.rows[0].id, profile.email || null, JSON.stringify({ displayName: profile.displayName, emailVerified: profile.emailVerified })],
    );
    user = await loadUser(pool, inserted.rows[0].id);
  } else {
    await pool.query('UPDATE sys.auth_external_identities SET last_login_at=now(),email=$3 WHERE provider=$1 AND subject=$2', [profile.provider, profile.subject, profile.email || null]);
  }
  const groupRoleMap = binding.config.directoryGroupRoleMap && typeof binding.config.directoryGroupRoleMap === 'object' && !Array.isArray(binding.config.directoryGroupRoleMap)
    ? binding.config.directoryGroupRoleMap as Record<string, unknown>
    : {};
  const mappedRole = 'groups' in profile ? profile.groups.map((group) => groupRoleMap[group]).find((role) => typeof role === 'string') : undefined;
  if (user && typeof mappedRole === 'string') {
    await pool.query(`UPDATE public.auth_users SET role_id=(SELECT id FROM public.auth_roles WHERE name=$2 LIMIT 1),updated_at=now() WHERE id=$1 AND EXISTS(SELECT 1 FROM public.auth_roles WHERE name=$2)`, [user.id, mappedRole]);
    user = await loadUser(pool, user.id);
  }
  if (!user) throw new ServiceError('AUTH_REQUIRED', 'The linked member is inactive', 401);
  return user;
}

export async function executeAuthSessionService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  if (operation === 'logout') return { data: { loggedOut: true }, clearCookie: true };
  if (operation === 'listProviders') return { data: { providers: providersFor(binding) } };
  if (operation === 'me') {
    if (ctx.actor.type !== 'tenant-user') throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    return { data: { user: ctx.actor } };
  }
  const { pool } = await dbFor(ctx);
  await ensureFederatedAuthSchema(pool);

  if (operation === 'startExternalLogin') {
    const provider = String(input.provider) as SocialAuthProvider;
    if (!['google', 'line', 'facebook', 'entra'].includes(provider) || !providersFor(binding).includes(provider)) throw new ServiceError('PROVIDER_NOT_ALLOWED', 'This login provider is not enabled', 403);
    const clientId = resolveSecretReference(binding.secretRefs?.[`${provider}ClientId`]);
    const start = createOAuthStart(provider, clientId, String(input.redirectUri));
    await storeOAuthState(pool, { state: start.state, provider, bindingId: binding.id, verifier: start.verifier, nonce: start.nonce, redirectUri: String(input.redirectUri) });
    return { data: { authorizationUrl: start.authorizationUrl } };
  }
  if (operation === 'completeExternalLogin') {
    const provider = String(input.provider) as SocialAuthProvider;
    if (!['google', 'line', 'facebook', 'entra'].includes(provider) || !providersFor(binding).includes(provider)) throw new ServiceError('PROVIDER_NOT_ALLOWED', 'This login provider is not enabled', 403);
    const redirectUri = String(input.redirectUri);
    const state = await consumeOAuthState(pool, { state: String(input.state), provider, bindingId: binding.id, redirectUri });
    const profile = await exchangeOAuthCode({
      provider, code: String(input.code), verifier: state.verifier, redirectUri,
      clientId: resolveSecretReference(binding.secretRefs?.[`${provider}ClientId`]),
      clientSecret: resolveSecretReference(binding.secretRefs?.[`${provider}ClientSecret`]),
    });
    return sessionResult(ctx, binding, await externalUser(pool, binding, profile));
  }
  if (operation === 'directoryLogin') {
    const provider = String(input.provider) as DirectoryProvider;
    if (!['ldap', 'ad-ds'].includes(provider) || !providersFor(binding).includes(provider)) throw new ServiceError('PROVIDER_NOT_ALLOWED', 'This directory provider is not enabled', 403);
    const profile = await authenticateDirectory({
      config: {
        provider,
        url: String(binding.config.directoryUrl || ''),
        baseDn: String(binding.config.directoryBaseDn || ''),
        userFilter: String(binding.config.directoryUserFilter || (provider === 'ad-ds' ? '(sAMAccountName={{username}})' : '(uid={{username}})')),
        groupBaseDn: binding.config.directoryGroupBaseDn ? String(binding.config.directoryGroupBaseDn) : undefined,
        groupFilter: binding.config.directoryGroupFilter ? String(binding.config.directoryGroupFilter) : undefined,
        rejectUnauthorized: binding.config.directoryRejectUnauthorized !== false,
      },
      bindDn: resolveSecretReference(binding.secretRefs?.directoryBindDn),
      bindPassword: resolveSecretReference(binding.secretRefs?.directoryBindPassword),
      username: String(input.username), password: String(input.password),
    });
    return sessionResult(ctx, binding, await externalUser(pool, binding, profile));
  }
  if (operation === 'register') {
    if (!providersFor(binding).includes('local') || !binding.config.allowRegister) throw new ServiceError('REGISTRATION_DISABLED', 'Local registration is disabled', 403);
    const email = String(input.email).trim().toLowerCase();
    const username = email.split('@')[0].replace(/[^a-z0-9_.-]/gi, '').slice(0, 80) || `member_${randomBytes(6).toString('hex')}`;
    try {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO public.auth_users(username,email,password_hash,display_name,is_active,role_id)
         VALUES($1,$2,crypt($3,gen_salt('bf')),$4,true,(SELECT id FROM public.auth_roles WHERE name='member' LIMIT 1)) RETURNING id::text`,
        [username, email, String(input.password), String(input.displayName).trim()],
      );
      const user = await loadUser(pool, inserted.rows[0].id);
      if (!user) throw new Error('Registered user unavailable');
      return sessionResult(ctx, binding, user);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ServiceError('ACCOUNT_EXISTS', 'An account already exists for this email or username', 409);
      throw error;
    }
  }
  const config = authConfig(ctx, binding);
  const secret = resolveSecretReference(binding.secretRefs?.signingKey || `env://${config.secretEnvKey}`);
  if (operation === 'refresh') {
    const refreshActor = ctx.refreshActor;
    if (refreshActor?.type !== 'tenant-user' || !refreshActor.userId) throw new ServiceError('AUTH_REQUIRED', 'A valid refresh session is required', 401);
    const user = await loadUser(pool, refreshActor.userId);
    if (!user || (refreshActor.sessionVersion !== undefined && refreshActor.sessionVersion !== user.session_version)) throw new ServiceError('AUTH_REQUIRED', 'The refresh session is no longer active', 401);
    const roles = user.role_name ? [user.role_name] : [];
    const token = issueJwt({ sub: user.id, email: user.email, roles, permissions: user.permissions, sessionVersion: user.session_version, tokenUse: 'access' }, config, secret);
    return { data: { token, user: { id: user.id, email: user.email, roles, permissions: user.permissions } }, token, maxAge: config.accessTokenTtlSeconds };
  }
  if (operation === 'login') {
    if (!providersFor(binding).includes('local')) throw new ServiceError('PROVIDER_NOT_ALLOWED', 'Local login is disabled', 403);
    const identityField = binding.config.identityField === 'username' ? 'username' : 'email';
    const identity = String(input[identityField] ?? '').trim();
    if (!identity) throw new ServiceError('SERVICE_INPUT_INVALID', `${identityField === 'username' ? 'Username' : 'Email'} is required`, 400, false, { [identityField]: 'required' });
    const result = await pool.query<{ id: string }>(`SELECT id::text FROM public.auth_users WHERE lower(${identityField})=lower($1) AND is_active=true AND crypt($2,password_hash)=password_hash LIMIT 1`, [identity, String(input.password)]);
    if (!result.rowCount) throw new ServiceError('AUTH_REQUIRED', `${identityField === 'username' ? 'Username' : 'Email'} or password is incorrect`, 401);
    const user = await loadUser(pool, result.rows[0].id);
    if (!user) throw new ServiceError('AUTH_REQUIRED', 'The account is inactive', 401);
    return sessionResult(ctx, binding, user);
  }
  if (operation === 'revokeSessions') {
    if (ctx.actor.type !== 'tenant-user' || !ctx.actor.userId) throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    await pool.query('UPDATE public.auth_users SET session_version=session_version+1,updated_at=now() WHERE id=$1', [ctx.actor.userId]);
    return { data: { revoked: true }, clearCookie: true };
  }
  if (operation === 'changePassword') {
    if (ctx.actor.type !== 'tenant-user' || !ctx.actor.userId) throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    const result = await pool.query(`UPDATE public.auth_users SET password_hash=crypt($1, gen_salt('bf')),session_version=session_version+1,updated_at=now() WHERE id=$2 AND crypt($3,password_hash)=password_hash`, [String(input.newPassword), ctx.actor.userId, String(input.currentPassword)]);
    if (!result.rowCount) throw new ServiceError('AUTH_REQUIRED', 'Current password is incorrect', 401);
    return { data: { changed: true }, clearCookie: true };
  }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported auth operation '${operation}'`, 405);
}
