import "server-only";
import { getCoreDb } from "@/lib/db/coreDb";

export interface DashboardCounts {
  apps: number;
  users: number;
  platforms: number;
  pages: number;
  auditLogs: number;
}

export interface DashboardSiteSummary {
  appId: string;
  appSlug: string;
  appName: string;
  primaryDomain: string;
  port: number;
  packageName: string;
  expiresAt: string | null;
  isActive: boolean;
  isSuspended: boolean;
  platformId: string | null;
}

const visibleApps = `
  SELECT app.*
  FROM public.apps app
  WHERE $2::boolean
     OR app.owner_user_id = $1
     OR EXISTS (
       SELECT 1 FROM public.app_memberships membership
       WHERE membership.app_id = app.id AND membership.user_id = $1
     )
`;

export async function loadDashboardCounts(actorId: string, auditActor: string, isGod: boolean): Promise<DashboardCounts> {
  const result = await getCoreDb().query<Record<string, string>>(`
    WITH visible_apps AS (${visibleApps}),
         visible_platforms AS (
           SELECT DISTINCT platform_id FROM visible_apps WHERE platform_id IS NOT NULL
         )
    SELECT
      (SELECT COUNT(*) FROM visible_apps WHERE is_active)::text AS apps,
      (SELECT COUNT(*) FROM public.platform_users user_account
       WHERE user_account.is_active
         AND ($2::boolean OR EXISTS (
           SELECT 1 FROM public.app_memberships membership
           JOIN visible_apps app ON app.id = membership.app_id
           WHERE membership.user_id = user_account.id
         )))::text AS users,
      (SELECT COUNT(*) FROM public.platforms platform
       WHERE $2::boolean OR platform.id IN (SELECT platform_id FROM visible_platforms))::text AS platforms,
      (SELECT COUNT(*) FROM public.platform_pages page
       WHERE $2::boolean OR page.platform_id IN (SELECT platform_id FROM visible_platforms))::text AS pages,
      (SELECT COUNT(*) FROM public.platform_audit_logs audit
       WHERE $2::boolean OR (
         audit.platform_id IN (SELECT platform_id FROM visible_platforms)
         AND audit.performed_by = $3
       ))::text AS audit_logs
  `, [actorId, isGod, auditActor]);
  const row = result.rows[0] ?? {};
  return {
    apps: Number(row.apps ?? 0),
    users: Number(row.users ?? 0),
    platforms: Number(row.platforms ?? 0),
    pages: Number(row.pages ?? 0),
    auditLogs: Number(row.audit_logs ?? 0),
  };
}

export async function loadDashboardSites(actorId: string, isGod: boolean): Promise<DashboardSiteSummary[]> {
  const result = await getCoreDb().query<{
    id: string;
    app_slug: string;
    app_name: string;
    subdomain: string;
    port: number;
    package_name: string;
    package_expires_at: Date | null;
    is_active: boolean;
    is_suspended: boolean;
    primary_domain: string | null;
    platform_id: string | null;
  }>(`
    WITH visible_apps AS (${visibleApps})
    SELECT app.id, app.app_slug, app.app_name, app.subdomain, app.port,
           app.package_name, app.package_expires_at, app.is_active, app.is_suspended,
           app.platform_id,
           (SELECT domain.domain FROM public.app_domains domain
             WHERE domain.app_id = app.id AND domain.is_active
             ORDER BY domain.is_primary DESC, domain.domain LIMIT 1) AS primary_domain
    FROM visible_apps app
    ORDER BY app.is_active DESC, app.app_name
  `, [actorId, isGod]);

  return result.rows.map((row) => ({
    appId: row.id,
    appSlug: row.app_slug,
    appName: row.app_name,
    primaryDomain: row.primary_domain ?? row.subdomain,
    port: row.port,
    packageName: row.package_name,
    expiresAt: row.package_expires_at ? row.package_expires_at.toISOString().slice(0, 10) : null,
    isActive: row.is_active,
    isSuspended: row.is_suspended,
    platformId: row.platform_id,
  }));
}
