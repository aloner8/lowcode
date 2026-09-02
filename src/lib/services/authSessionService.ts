import 'server-only';
import { getAppTenantDb, getTenantDb } from '@/lib/db/tenantDb';
import { issueJwt, type JwtServiceConfig } from './jwtAuthService';
import { resolveSecretReference } from './secrets';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

const authConfig = (ctx: ServiceExecutionContext, binding: StudioServiceDefinition): JwtServiceConfig => ({
  algorithm: 'HS256', issuer: String(binding.config.issuer || ctx.slug), audience: String(binding.config.audience || `${ctx.slug}-runtime`),
  accessTokenTtlSeconds: Number(binding.config.accessTokenTtlSeconds || 900), secretEnvKey: String(binding.config.secretEnvKey || 'PLATFORM_JWT_SECRET'),
});
const dbFor = async (ctx: ServiceExecutionContext) => ctx.scope.appId ? getAppTenantDb(ctx.scope.appId) : getTenantDb(ctx.scope.platformId);

export async function executeAuthSessionService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  if (operation === 'logout') return { data: { loggedOut: true }, clearCookie: true };
  if (operation === 'me') {
    if (ctx.actor.type !== 'tenant-user') throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    return { data: { user: ctx.actor } };
  }
  const config = authConfig(ctx, binding);
  const secret = resolveSecretReference(binding.secretRefs?.signingKey || `env://${config.secretEnvKey}`);
  const { pool } = await dbFor(ctx);
  if (operation === 'refresh') {
    const refreshActor = ctx.refreshActor;
    if (refreshActor?.type !== 'tenant-user' || !refreshActor.userId) throw new ServiceError('AUTH_REQUIRED', 'A valid refresh session is required', 401);
    const current = await pool.query<{ id: string; email: string; role_name: string | null; permissions: string[] }>(`SELECT u.id::text,u.email,r.name AS role_name,COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL),'{}') AS permissions FROM public.auth_users u LEFT JOIN public.auth_roles r ON r.id=u.role_id LEFT JOIN public.auth_role_permissions rp ON rp.role_id=r.id LEFT JOIN public.auth_permissions p ON p.id=rp.permission_id WHERE u.id=$1 AND u.is_active=true GROUP BY u.id,u.email,r.name`, [refreshActor.userId]);
    if (!current.rowCount) throw new ServiceError('AUTH_REQUIRED', 'The refresh session is no longer active', 401);
    const user = current.rows[0]; const roles = user.role_name ? [user.role_name] : [];
    const token = issueJwt({ sub: user.id, email: user.email, roles, permissions: user.permissions, tokenUse: 'access' }, config, secret);
    return { data: { token, user: { id: user.id, email: user.email, roles, permissions: user.permissions } }, token, maxAge: config.accessTokenTtlSeconds };
  }
  if (operation === 'login') {
    const result = await pool.query<{ id: string; email: string; display_name: string | null; role_name: string | null; permissions: string[] }>(
      `SELECT u.id::text, u.email, u.display_name, r.name AS role_name,
              COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM public.auth_users u LEFT JOIN public.auth_roles r ON r.id=u.role_id
       LEFT JOIN public.auth_role_permissions rp ON rp.role_id=r.id
       LEFT JOIN public.auth_permissions p ON p.id=rp.permission_id
       WHERE lower(u.email)=lower($1) AND u.is_active=true AND crypt($2,u.password_hash)=u.password_hash
       GROUP BY u.id,u.email,u.display_name,r.name LIMIT 1`, [String(input.email).trim(), String(input.password)],
    );
    if (!result.rowCount) throw new ServiceError('AUTH_REQUIRED', 'Email or password is incorrect', 401);
    const user = result.rows[0];
    const actor = { id: user.id, email: user.email, displayName: user.display_name, roles: user.role_name ? [user.role_name] : [], permissions: user.permissions };
    const token = issueJwt({ sub: user.id, email: user.email, roles: actor.roles, permissions: user.permissions, tokenUse: 'access' }, config, secret);
    const refreshMaxAge = Number(binding.config.refreshTokenTtlSeconds || 604800);
    const refreshToken = issueJwt({ sub: user.id, email: user.email, roles: actor.roles, permissions: user.permissions, tokenUse: 'refresh' }, { ...config, accessTokenTtlSeconds: refreshMaxAge }, secret);
    const successFlow = (ctx.snapshot.flows || []).find((item: any) => item.routePath === (binding.bundle?.flowPath || '/login'));
    const successNode = successFlow?.nodes?.find((item: any) => item.id === 'login.success' || item.data?.actionType === 'navigate');
    return { data: { token, user: actor, successPageId: successNode?.data?.targetPageId || binding.bundle?.adminPageId }, token, refreshToken, maxAge: config.accessTokenTtlSeconds, refreshMaxAge };
  }
  if (operation === 'changePassword') {
    if (ctx.actor.type !== 'tenant-user' || !ctx.actor.userId) throw new ServiceError('AUTH_REQUIRED', 'Authentication is required', 401);
    const result = await pool.query(`UPDATE public.auth_users SET password_hash=crypt($1, gen_salt('bf')), updated_at=now() WHERE id=$2 AND crypt($3,password_hash)=password_hash`, [String(input.newPassword), ctx.actor.userId, String(input.currentPassword)]);
    if (!result.rowCount) throw new ServiceError('AUTH_REQUIRED', 'Current password is incorrect', 401);
    return { data: { changed: true } };
  }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported auth operation '${operation}'`, 405);
}
