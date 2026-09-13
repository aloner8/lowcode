import "server-only";
import { getCoreDb } from "@/lib/db/coreDb";
import type { AppRuntimeState } from "@/lib/runtime/appRuntimeState";

export interface AdminAppDetail {
  id: string;
  slug: string;
  name: string;
  customer: { id: string; slug: string; name: string };
  template: { id: string; slug: string; name: string };
  revision: { id: string; number: number; digest: string } | null;
  tenantDbName: string;
  schemaRevision: string | null;
  port: number;
  packageName: string;
  isActive: boolean;
  isSuspended: boolean;
  canControl: boolean;
  quota: { apps: number; maxApps: number; running: number; maxRunning: number };
  runtime: Pick<AppRuntimeState, "desiredState" | "observedState" | "error" | "healthCheckedAt" | "metrics" | "metricsAt">;
  domains: Array<{
    domain: string;
    isPrimary: boolean;
    isActive: boolean;
    readiness: "PENDING_DNS" | "PENDING_PROXY" | "READY";
    verifiedAt: string | null;
    error: string | null;
  }>;
  operations: Array<{
    id: string;
    type: "PROVISION" | "START" | "STOP" | "UPDATE_REVISION";
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    checkpoint: string;
    error: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
}

export async function loadAdminAppDetail(
  appId: string,
  actorId: string,
  isGod: boolean,
): Promise<AdminAppDetail | null> {
  const db = getCoreDb();
  const appResult = await db.query<{
    id: string; app_slug: string; app_name: string; tenant_db_name: string;
    schema_revision: string | null; port: number; package_name: string;
    is_active: boolean; is_suspended: boolean; can_control: boolean;
    desired_state: AppRuntimeState["desiredState"]; observed_state: AppRuntimeState["observedState"];
    runtime_error_detail: string | null; health_checked_at: Date | null;
    runtime_metrics: AppRuntimeState["metrics"]; runtime_metrics_at: Date | null;
    customer_id: string; customer_slug: string; customer_name: string; quotas: Record<string, number>;
    template_id: string; template_slug: string; template_name: string;
    revision_id: string | null; revision_number: string | null; revision_digest: string | null;
    app_count: string; running_count: string;
  }>(`
    SELECT app.id, app.app_slug, app.app_name, app.tenant_db_name, app.schema_revision,
           app.port, app.package_name, app.is_active, app.is_suspended,
           app.desired_state, app.observed_state, app.runtime_error_detail,
           app.health_checked_at, app.runtime_metrics, app.runtime_metrics_at,
           customer.id AS customer_id, customer.customer_slug, customer.customer_name, customer.quotas,
           template.id AS template_id, template.template_slug, template.template_name,
           revision.id AS revision_id, revision.revision_number::text, revision.revision_digest,
           ($3::boolean OR EXISTS (
             SELECT 1 FROM public.app_memberships control_membership
             WHERE control_membership.app_id = app.id AND control_membership.user_id = $2
               AND control_membership.app_role = 'ADMIN'
           )) AS can_control,
           (SELECT COUNT(*)::text FROM public.apps sibling
             JOIN public.templates sibling_template ON sibling_template.id = sibling.template_id
             WHERE sibling_template.customer_id = customer.id) AS app_count,
           (SELECT COUNT(*)::text FROM public.apps sibling
             JOIN public.templates sibling_template ON sibling_template.id = sibling.template_id
             WHERE sibling_template.customer_id = customer.id
               AND (sibling.desired_state = 'RUNNING'
                 OR sibling.observed_state IN ('STARTING', 'RUNNING', 'STOPPING'))) AS running_count
    FROM public.apps app
    JOIN public.templates template ON template.id = app.template_id
    JOIN public.customers customer ON customer.id = template.customer_id
    LEFT JOIN public.template_revisions revision
      ON revision.id = app.template_revision_id AND revision.template_id = template.id
    WHERE app.id = $1
      AND ($3::boolean OR app.owner_user_id = $2 OR EXISTS (
        SELECT 1 FROM public.app_memberships visible_membership
        WHERE visible_membership.app_id = app.id AND visible_membership.user_id = $2
      ))
  `, [appId, actorId, isGod]);
  if (!appResult.rowCount) return null;

  const [domainResult, operationResult] = await Promise.all([
    db.query<{
      domain: string; is_primary: boolean; is_active: boolean;
      readiness_status: AdminAppDetail["domains"][number]["readiness"];
      verified_at: Date | null; last_error: string | null;
    }>(`SELECT domain, is_primary, is_active, readiness_status, verified_at, last_error
        FROM public.app_domains WHERE app_id = $1
        ORDER BY is_primary DESC, domain`, [appId]),
    db.query<{
      id: string; operation_type: AdminAppDetail["operations"][number]["type"];
      status: AdminAppDetail["operations"][number]["status"]; checkpoint: string;
      error_detail: string | null; created_at: Date; finished_at: Date | null;
    }>(`SELECT id, operation_type, status, checkpoint, error_detail, created_at, finished_at
        FROM public.app_operations WHERE app_id = $1
        ORDER BY created_at DESC LIMIT 10`, [appId]),
  ]);

  const row = appResult.rows[0];
  return {
    id: row.id,
    slug: row.app_slug,
    name: row.app_name,
    customer: { id: row.customer_id, slug: row.customer_slug, name: row.customer_name },
    template: { id: row.template_id, slug: row.template_slug, name: row.template_name },
    revision: row.revision_id ? { id: row.revision_id, number: Number(row.revision_number), digest: row.revision_digest! } : null,
    tenantDbName: row.tenant_db_name,
    schemaRevision: row.schema_revision,
    port: row.port,
    packageName: row.package_name,
    isActive: row.is_active,
    isSuspended: row.is_suspended,
    canControl: row.can_control,
    quota: {
      apps: Number(row.app_count),
      maxApps: row.quotas?.maxApps ?? 0,
      running: Number(row.running_count),
      maxRunning: row.quotas?.maxRunningApps ?? 0,
    },
    runtime: {
      desiredState: row.desired_state,
      observedState: row.observed_state,
      error: row.runtime_error_detail,
      healthCheckedAt: row.health_checked_at?.toISOString() ?? null,
      metrics: row.runtime_metrics,
      metricsAt: row.runtime_metrics_at?.toISOString() ?? null,
    },
    domains: domainResult.rows.map((domain) => ({
      domain: domain.domain,
      isPrimary: domain.is_primary,
      isActive: domain.is_active,
      readiness: domain.readiness_status,
      verifiedAt: domain.verified_at?.toISOString() ?? null,
      error: domain.last_error,
    })),
    operations: operationResult.rows.map((operation) => ({
      id: operation.id,
      type: operation.operation_type,
      status: operation.status,
      checkpoint: operation.checkpoint,
      error: operation.error_detail,
      createdAt: operation.created_at.toISOString(),
      finishedAt: operation.finished_at?.toISOString() ?? null,
    })),
  };
}
