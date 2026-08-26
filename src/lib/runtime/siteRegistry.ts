import 'server-only';

import { getCoreDb } from '@/lib/db/coreDb';
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
});

const SELECT_SITES = `
  SELECT app_id, app_slug, app_name, port, subdomain, tenant_db_name, is_active,
         theme_config, tenant_overrides, seo_settings, platform_id, platform_slug, domains
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
    `${SELECT_SITES} WHERE $1 = ANY(domains) OR LOWER(subdomain) = $1 LIMIT 1`,
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
    if (site.subdomain) map[site.subdomain.toLowerCase()] = site.appSlug;
  }
  return map;
}

export async function addSiteDomain(appId: string, domain: string, isPrimary = false): Promise<void> {
  await getCoreDb().query(
    `INSERT INTO public.app_domains (app_id, domain, is_primary) VALUES ($1, LOWER(BTRIM($2)), $3)
     ON CONFLICT (LOWER(BTRIM(domain))) DO UPDATE SET app_id = excluded.app_id, is_active = TRUE`,
    [appId, domain, isPrimary],
  );
}

export async function removeSiteDomain(appId: string, domain: string): Promise<boolean> {
  const result = await getCoreDb().query(
    'DELETE FROM public.app_domains WHERE app_id = $1 AND LOWER(BTRIM(domain)) = LOWER(BTRIM($2)) AND is_primary = FALSE',
    [appId, domain],
  );
  return Boolean(result.rowCount);
}
