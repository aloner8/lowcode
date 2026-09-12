import type { TemplateDefinition } from "@/lib/template/contracts";
import { applyAppSchema } from "./appSchema";
import { getCoreDb } from "./coreDb";
import { provisionAppTenantDb } from "./tenantDb";

interface ProvisionRow {
  app_id: string;
  tenant_db_name: string;
  operation_id: string;
  operation_status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  revision_digest: string;
  compiled_definition: TemplateDefinition;
}

export interface TemplateAppProvisionResult {
  appId: string;
  operationId: string;
  database: string;
  revision: string;
  tables: string[];
  reused: boolean;
}

/**
 * Resumable external provisioning after register_template_app committed.
 * Every step is idempotent so a retry can continue after process interruption.
 */
export async function provisionTemplateAppDatabase(
  appId: string,
  operationId: string,
): Promise<TemplateAppProvisionResult> {
  const db = getCoreDb();
  const source = await db.query<ProvisionRow>(
    `SELECT app.id AS app_id, app.tenant_db_name,
            operation.id AS operation_id, operation.status AS operation_status,
            revision.revision_digest, revision.compiled_definition
     FROM public.apps app
     JOIN public.app_operations operation
       ON operation.app_id = app.id AND operation.operation_type = 'PROVISION'
     JOIN public.template_revisions revision
       ON revision.id = app.template_revision_id
      AND revision.template_id = app.template_id
     WHERE app.id = $1 AND operation.id = $2`,
    [appId, operationId],
  );
  if (!source.rowCount) throw new Error("App provision operation not found");
  const row = source.rows[0];
  if (row.operation_status === "COMPLETED") {
    return {
      appId,
      operationId,
      database: row.tenant_db_name,
      revision: row.revision_digest,
      tables: row.compiled_definition.collections.map((item) => item.tableName),
      reused: true,
    };
  }

  try {
    await db.query(
      `UPDATE public.app_operations
       SET status = 'RUNNING', error_detail = NULL,
           started_at = COALESCE(started_at, NOW())
       WHERE id = $1`,
      [operationId],
    );
    const provisioned = await provisionAppTenantDb(appId);
    await db.query(
      `UPDATE public.app_operations
       SET checkpoint = 'DATABASE_READY',
           result = result || $2::jsonb
       WHERE id = $1`,
      [operationId, JSON.stringify({ databaseCreated: provisioned.created })],
    );

    const schema = await applyAppSchema(
      provisioned.pool,
      row.compiled_definition,
    );
    await db.query(
      `UPDATE public.apps
       SET observed_state = 'STOPPED', schema_revision = $2,
           runtime_error_detail = NULL
       WHERE id = $1`,
      [appId, row.revision_digest],
    );
    await db.query(
      `UPDATE public.app_operations
       SET status = 'COMPLETED', checkpoint = 'SCHEMA_READY',
           result = result || $2::jsonb, finished_at = NOW(), error_detail = NULL
       WHERE id = $1`,
      [
        operationId,
        JSON.stringify({ tables: schema.tables }),
      ],
    );
    return {
      appId,
      operationId,
      database: provisioned.database,
      revision: row.revision_digest,
      tables: schema.tables,
      reused: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provisioning error";
    await db.query(
      `UPDATE public.apps
       SET observed_state = 'FAILED', runtime_error_detail = $2
       WHERE id = $1`,
      [appId, message.slice(0, 4000)],
    ).catch(() => undefined);
    await db.query(
      `UPDATE public.app_operations
       SET status = 'FAILED', error_detail = $2, finished_at = NOW()
       WHERE id = $1`,
      [operationId, message.slice(0, 4000)],
    ).catch(() => undefined);
    throw error;
  }
}
