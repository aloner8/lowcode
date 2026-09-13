import 'server-only';
import { randomUUID } from 'node:crypto';
import { getCoreDb } from '@/lib/db/coreDb';
import { verifyJwt } from './jwtAuthService';
import { bindingFor, serviceKeyOf } from './bindings';
import { resolveSecretReference } from './secrets';
import type { StudioServiceDefinition } from '@/types';
import { resolveAppServiceBindings } from './appBindings';

export interface ServiceActor {
  type: 'platform-user' | 'tenant-user' | 'anonymous' | 'system';
  userId?: string;
  roles: string[];
  permissions: string[];
  email?: string;
}

export interface ServiceExecutionContext {
  requestId: string;
  traceId: string;
  actor: ServiceActor;
  refreshActor?: ServiceActor;
  scope: { platformId: string; appId?: string; tenantId: string; authRealm: 'platform' | 'tenant' };
  slug: string;
  publishedRevision: string;
  snapshot: Record<string, any>;
}

interface RuntimeRow {
  platform_id: string;
  app_id: string | null;
  platform_slug: string;
  app_slug: string | null;
  runtime_snapshot: Record<string, any>;
  runtime_build_revision: string | null;
  template_modules: unknown;
}

const cookieValue = (request: Request, name: string) => request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
export const tenantSessionCookieName = (slug: string) => `tenant_session_${slug.replace(/[^a-z0-9]/gi, '_').slice(0, 80)}`;
export const tenantRefreshCookieName = (slug: string) => `tenant_refresh_${slug.replace(/[^a-z0-9]/gi, '_').slice(0, 80)}`;

export async function resolveRuntimeContext(request: Request, slug: string): Promise<ServiceExecutionContext | null> {
  const result = await getCoreDb().query<RuntimeRow>(
    `SELECT p.id AS platform_id, a.id AS app_id, p.platform_slug, a.app_slug,
            p.runtime_snapshot, p.runtime_build_revision,
            revision.compiled_definition->'modules' AS template_modules
     FROM public.platforms p
     LEFT JOIN public.apps a ON a.platform_id=p.id AND a.app_slug=$1 AND a.is_active
     LEFT JOIN public.template_revisions revision
       ON revision.id=a.template_revision_id AND revision.template_id=a.template_id
     WHERE (a.app_slug=$1 OR p.platform_slug=$1) AND p.runtime_snapshot IS NOT NULL
     ORDER BY a.app_slug NULLS LAST LIMIT 1`, [slug],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const snapshot = {
    ...row.runtime_snapshot,
    services: await resolveAppServiceBindings(row.platform_id, row.app_id || undefined, row.runtime_snapshot.services),
    ...(row.app_id ? { templateModules: Array.isArray(row.template_modules) ? row.template_modules : [] } : {}),
  };
  let actor: ServiceActor = { type: 'anonymous', roles: [], permissions: [] };
  let refreshActor: ServiceActor | undefined;
  const authBinding = (snapshot.services as unknown[] | undefined)?.map((entry) => entry as StudioServiceDefinition).find((entry) => serviceKeyOf(entry) === 'auth.session');
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || cookieValue(request, tenantSessionCookieName(slug)) || cookieValue(request, 'tenant_session');
  if (bearer && authBinding) {
    try {
      const normalized = bindingFor(snapshot.services, authBinding.id)!;
      const config = {
        algorithm: 'HS256' as const,
        issuer: String(normalized.config.issuer || slug), audience: String(normalized.config.audience || `${slug}-runtime`),
        accessTokenTtlSeconds: Number(normalized.config.accessTokenTtlSeconds || 900),
        secretEnvKey: String(normalized.config.secretEnvKey || 'PLATFORM_JWT_SECRET'),
      };
      const secret = resolveSecretReference(normalized.secretRefs?.signingKey || `env://${config.secretEnvKey}`);
      const claims = verifyJwt(bearer, config, secret);
      if (claims.tokenUse === 'refresh') throw new Error('Refresh token cannot authenticate a service request');
      actor = { type: 'tenant-user', userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined, roles: Array.isArray(claims.roles) ? claims.roles : [], permissions: Array.isArray(claims.permissions) ? claims.permissions as string[] : [] };
    } catch { /* An invalid tenant cookie is treated as anonymous. */ }
  }
  const refreshToken = cookieValue(request, tenantRefreshCookieName(slug));
  if (refreshToken && authBinding) {
    try {
      const normalized = bindingFor(snapshot.services, authBinding.id)!;
      const config = { algorithm: 'HS256' as const, issuer: String(normalized.config.issuer || slug), audience: String(normalized.config.audience || `${slug}-runtime`), accessTokenTtlSeconds: Number(normalized.config.refreshTokenTtlSeconds || 604800), secretEnvKey: String(normalized.config.secretEnvKey || 'PLATFORM_JWT_SECRET') };
      const claims = verifyJwt(refreshToken, config, resolveSecretReference(normalized.secretRefs?.signingKey || `env://${config.secretEnvKey}`));
      if (claims.tokenUse !== 'refresh') throw new Error('Invalid refresh token');
      refreshActor = { type: 'tenant-user', userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined, roles: Array.isArray(claims.roles) ? claims.roles : [], permissions: Array.isArray(claims.permissions) ? claims.permissions as string[] : [] };
    } catch { /* Invalid refresh cookies never authenticate normal operations. */ }
  }
  const requestIdHeader = request.headers.get('x-request-id');
  const requestId = requestIdHeader && /^[0-9a-f-]{36}$/i.test(requestIdHeader) ? requestIdHeader : randomUUID();
  return {
    requestId, traceId: request.headers.get('x-trace-id')?.slice(0, 120) || requestId, actor, refreshActor,
    scope: { platformId: row.platform_id, appId: row.app_id || undefined, tenantId: row.app_id || row.platform_id, authRealm: 'tenant' },
    slug, publishedRevision: row.runtime_build_revision || 'unversioned', snapshot,
  };
}
