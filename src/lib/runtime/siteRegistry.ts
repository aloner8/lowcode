import 'server-only';

import { getCoreDb } from '@/lib/db/coreDb';
import { randomBytes } from 'node:crypto';
import type { ThemeConfig, TenantOverrides } from '@/types';

/**
 * The registry of hosted sites.
 *
 * Each Tenant App is one site: it owns a port, a tenant database and one or
 * more domains. The multi-site entry script (`scripts/run-sites.mjs`) starts a
 * process per site from this registry, and the Nginx generator maps the
 * domains onto those ports.
 */

export interface SiteRecord {
  appId: string;
  appSlug: string;
  appName: string;
  port: number;
  subdomain: string;
  tenantDbName: string;
  isActive: boolean;
  themeConfig: ThemeConfig;
  tenantOverrides: TenantOverrides;
  seoSettings: Record<string, unknown>;
  platformId: string | null;
  platformSlug: string | null;
  domains: string[];
  desiredState: 'RUNNING' | 'STOPPED';
  observedState: 'UNPROVISIONED' | 'PROVISIONING' | 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAILED';
  runtimeError: string | null;
  healthCheckedAt: string | null;
  runtimeMetrics: { memoryRssBytes?: number; uptimeSeconds?: number } | null;
  runtimeMetricsAt: string | null;
}

export interface AppDomainRecord {
  id: string;
  domain: string;
  isPrimary: boolean;
  forceHttps: boolean;
  isActive: boolean;
  readinessStatus: 'PENDING_DNS' | 'PENDING_PROXY' | 'READY';
  dnsCheckedAt: string | null;
  proxyCheckedAt: string | null;
  verifiedAt: string | null;
  verificationToken: string | null;
  lastError: string | null;
}

interface SiteRow {
  app_id: string;
  app_slug: string;
  app_name: string;
  port: number;
  subdomain: string;
  tenant_db_name: string;
  is_active: boolean;
  theme_config: ThemeConfig;
  tenant_overrides: TenantOverrides;
  seo_settings: Record<string, unknown>;
  platform_id: string | null;
  platform_slug: string | null;
  domains: string[];
  desired_state: SiteRecord['desiredState'];
  observed_state: SiteRecord['observedState'];
  runtime_error_detail: string | null;
  health_checked_at: Date | null;
  runtime_metrics: SiteRecord['runtimeMetrics'];
  runtime_metrics_at: Date | null;
}

const toSite = (row: SiteRow): SiteRecord => ({
  appId: row.app_id,
  appSlug: row.app_slug,
  appName: row.app_name,
  port: row.port,
  subdomain: row.subdomain,
  tenantDbName: row.tenant_db_name,
  isActive: row.is_active,
  themeConfig: row.theme_config,
  tenantOverrides: row.tenant_overrides,
  seoSettings: row.seo_settings ?? {},
  platformId: row.platform_id,
  platformSlug: row.platform_slug,
  domains: row.domains ?? [],
  desiredState: row.desired_state,
  observedState: row.observed_state,
  runtimeError: row.runtime_error_detail,
  healthCheckedAt: row.health_checked_at?.toISOString() ?? null,
  runtimeMetrics: row.runtime_metrics,
  runtimeMetricsAt: row.runtime_metrics_at?.toISOString() ?? null,
});

const SELECT_SITES = `
  SELECT app_id, app_slug, app_name, port, subdomain, tenant_db_name, is_active,
         theme_config, tenant_overrides, seo_settings, platform_id, platform_slug, domains,
         desired_state, observed_state, runtime_error_detail, health_checked_at,
         runtime_metrics, runtime_metrics_at
  FROM public.site_registry
`;

export async function listSites(includeInactive = false): Promise<SiteRecord[]> {
  const result = await getCoreDb().query<SiteRow>(
    `${SELECT_SITES} ${includeInactive ? '' : 'WHERE is_active = TRUE'} ORDER BY port`,
  );
  return result.rows.map(toSite);
}

export async function findSiteBySlug(appSlug: string): Promise<SiteRecord | null> {
  const result = await getCoreDb().query<SiteRow>(`${SELECT_SITES} WHERE app_slug = $1`, [appSlug]);
  return result.rowCount ? toSite(result.rows[0]) : null;
}

/** Resolves a site from an incoming `Host` header (port and case are ignored). */
export async function findSiteByHost(host: string): Promise<SiteRecord | null> {
  const hostname = host.split(':')[0].trim().toLowerCase();
  if (!hostname) return null;

  const result = await getCoreDb().query<SiteRow>(
    `${SELECT_SITES} WHERE $1 = ANY(domains) LIMIT 1`,
    [hostname],
  );
  return result.rowCount ? toSite(result.rows[0]) : null;
}

/**
 * Compact `hostname -> appSlug` map.
 *
 * The entry script serialises this into the `SITE_DOMAIN_MAP` environment
 * variable so the Edge middleware can route by domain without a database call.
 */
export async function buildDomainMap(): Promise<Record<string, string>> {
  const sites = await listSites();
  const map: Record<string, string> = {};
  for (const site of sites) {
    for (const domain of site.domains) map[domain] = site.appSlug;
  }
  return map;
}

const mapDomain = (row: {
  id: string; domain: string; is_primary: boolean; force_https: boolean; is_active: boolean;
  readiness_status: AppDomainRecord['readinessStatus']; dns_checked_at: Date | null;
  proxy_checked_at: Date | null; verified_at: Date | null; last_error: string | null;
  verification_token: string | null;
}): AppDomainRecord => ({
  id: row.id,
  domain: row.domain,
  isPrimary: row.is_primary,
  forceHttps: row.force_https,
  isActive: row.is_active,
  readinessStatus: row.readiness_status,
  dnsCheckedAt: row.dns_checked_at?.toISOString() ?? null,
  proxyCheckedAt: row.proxy_checked_at?.toISOString() ?? null,
  verifiedAt: row.verified_at?.toISOString() ?? null,
  verificationToken: row.verification_token,
  lastError: row.last_error,
});

const DOMAIN_COLUMNS = `id, domain, is_primary, force_https, is_active,
  readiness_status, dns_checked_at, proxy_checked_at, verified_at, verification_token, last_error`;

export async function listAppDomains(appId: string): Promise<AppDomainRecord[]> {
  const result = await getCoreDb().query(`SELECT ${DOMAIN_COLUMNS}
    FROM public.app_domains WHERE app_id = $1 ORDER BY is_primary DESC, domain`, [appId]);
  return result.rows.map(mapDomain);
}

export async function addSiteDomain(appId: string, domain: string, isPrimary = false): Promise<AppDomainRecord> {
  const verificationToken = randomBytes(18).toString('base64url');
  const result = await getCoreDb().query(
    `INSERT INTO public.app_domains (app_id, domain, is_primary, readiness_status, verification_token)
     VALUES ($1, LOWER(BTRIM($2)), $3, 'PENDING_DNS', $4)
     RETURNING ${DOMAIN_COLUMNS}`,
    [appId, domain, isPrimary, verificationToken],
  );
  return mapDomain(result.rows[0]);
}

export async function removeSiteDomain(appId: string, domain: string): Promise<boolean> {
  const result = await getCoreDb().query(
    'DELETE FROM public.app_domains WHERE app_id = $1 AND LOWER(BTRIM(domain)) = LOWER(BTRIM($2)) AND is_primary = FALSE',
    [appId, domain],
  );
  return Boolean(result.rowCount);
}
