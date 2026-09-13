import type { TemplateDefinition } from "@/lib/template/contracts";
import { stableStringify } from "@/lib/template/compileTemplateDefinition";
import { applyAppSchema } from "./appSchema";
import { getCoreDb } from "./coreDb";
import { openTenantDbByName } from "./tenantDb";

interface AppRevisionRegistrationRow {
  app_id: string;
  customer_id: string;
  template_id: string;
  source_revision_id: string;
  tenant_db_name: string;
}

interface OperationRow {
  id: string;
  app_id: string;
  operation_type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  result: Record<string, unknown>;
}

interface RevisionUpdateSourceRow {
  app_id: string;
  tenant_db_name: string;
  source_revision_id: string;
  source_definition: TemplateDefinition;
  target_revision_id: string;
  target_digest: string;
  target_definition: TemplateDefinition;
  operation_status: OperationRow["status"];
}

export class TemplateAppRevisionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "TemplateAppRevisionError";
  }
}

export interface AppRevisionUpdateRegistration {
  appId: string;
  operationId: string;
  reused: boolean;
}

export interface AppRevisionUpdateResult {
  appId: string;
  operationId: string;
  revisionId: string;
  revision: string;
  reused: boolean;
}

export async function registerTemplateAppRevisionUpdate(input: {
  actorId: string;
  appId: string;
  revisionId: string;
  operationKey: string;
}): Promise<AppRevisionUpdateRegistration> {
  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const app = await client.query<AppRevisionRegistrationRow>(
      `SELECT app.id AS app_id, template.customer_id, app.template_id,
              app.template_revision_id AS source_revision_id, app.tenant_db_name
       FROM public.apps app
       JOIN public.templates template ON template.id = app.template_id
       WHERE app.id = $1
       FOR UPDATE OF app`,
      [input.appId],
    );
    if (!app.rowCount || !app.rows[0].template_id || !app.rows[0].source_revision_id) {
      throw new TemplateAppRevisionError("app_not_template_managed", "App นี้ไม่ได้ผูกกับ Template revision");
    }
    const source = app.rows[0];
    const target = await client.query<{ id: string }>(
      `SELECT id FROM public.template_revisions
       WHERE id = $1 AND template_id = $2`,
      [input.revisionId, source.template_id],
    );
    if (!target.rowCount) {
      throw new TemplateAppRevisionError("revision_not_found", "Revision ไม่อยู่ใน Template ของ App นี้");
    }

    const previous = await client.query<OperationRow>(
      `SELECT id, app_id, operation_type, status, result
       FROM public.app_operations
       WHERE customer_id = $1 AND operation_key = $2`,
      [source.customer_id, input.operationKey],
    );
    if (previous.rowCount) {
      const operation = previous.rows[0];
      if (
        operation.app_id !== input.appId ||
        operation.operation_type !== "UPDATE_REVISION" ||
        operation.result.targetRevisionId !== input.revisionId
      ) {
        throw new TemplateAppRevisionError("operation_key_conflict", "Idempotency-Key ถูกใช้กับคำสั่งอื่นแล้ว");
      }
      await client.query("COMMIT");
      return { appId: input.appId, operationId: operation.id, reused: true };
    }

    const active = await client.query<{ id: string }>(
      `SELECT id FROM public.app_operations
       WHERE app_id = $1 AND status IN ('PENDING', 'RUNNING')
       LIMIT 1`,
      [input.appId],
    );
    if (active.rowCount) {
      throw new TemplateAppRevisionError("operation_in_progress", "App มี operation ที่กำลังทำงานอยู่");
    }

    const completed = source.source_revision_id === input.revisionId;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO public.app_operations (
         customer_id, app_id, operation_key, operation_type, status,
         checkpoint, result, requested_by, started_at, finished_at
       ) VALUES (
         $1, $2, $3, 'UPDATE_REVISION', $4, $5, $6::jsonb, $7, NOW(), $8
       ) RETURNING id`,
      [
        source.customer_id,
        input.appId,
        input.operationKey,
        completed ? "COMPLETED" : "RUNNING",
        completed ? "REVISION_ACTIVE" : "REGISTERED",
        JSON.stringify({
          sourceRevisionId: source.source_revision_id,
          targetRevisionId: input.revisionId,
        }),
        input.actorId,
        completed ? new Date() : null,
      ],
    );
    await client.query("COMMIT");
    return { appId: input.appId, operationId: inserted.rows[0].id, reused: completed };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const assertSupportedRevisionUpdate = (
  source: TemplateDefinition,
  target: TemplateDefinition,
) => {
  if (source.schemaVersion !== target.schemaVersion) {
    throw new TemplateAppRevisionError(
      "schema_version_unsupported",
      `App image รองรับ schema ${source.schemaVersion} แต่ revision ใช้ ${target.schemaVersion}`,
    );
  }
  if (stableStringify(source.collections) !== stableStringify(target.collections)) {
    throw new TemplateAppRevisionError(
      "collection_schema_change_unsupported",
      "Revision นี้เปลี่ยน Collection schema; ต้องใช้ schema migration ก่อนอัปเดต App",
    );
  }
};

export async function applyTemplateAppRevisionUpdate(
  appId: string,
  operationId: string,
): Promise<AppRevisionUpdateResult> {
  const core = getCoreDb();
  const source = await core.query<RevisionUpdateSourceRow>(
    `SELECT app.id AS app_id, app.tenant_db_name,
            app.template_revision_id AS source_revision_id,
            source.compiled_definition AS source_definition,
            target.id AS target_revision_id,
            target.revision_digest AS target_digest,
            target.compiled_definition AS target_definition,
            operation.status AS operation_status
     FROM public.app_operations operation
     JOIN public.apps app ON app.id = operation.app_id
     JOIN public.template_revisions source
       ON source.id = app.template_revision_id AND source.template_id = app.template_id
     JOIN public.template_revisions target
       ON target.id = (operation.result->>'targetRevisionId')::uuid
      AND target.template_id = app.template_id
     WHERE operation.id = $1 AND operation.app_id = $2
       AND operation.operation_type = 'UPDATE_REVISION'`,
    [operationId, appId],
  );
  if (!source.rowCount) {
    throw new TemplateAppRevisionError("operation_not_found", "ไม่พบ operation อัปเดต revision");
  }
  const row = source.rows[0];
  if (row.operation_status === "COMPLETED") {
    return {
      appId,
      operationId,
      revisionId: row.target_revision_id,
      revision: row.target_digest,
      reused: true,
    };
  }

  try {
    assertSupportedRevisionUpdate(row.source_definition, row.target_definition);
    await core.query(
      `UPDATE public.app_operations
       SET status = 'RUNNING', checkpoint = 'VALIDATED', error_detail = NULL,
           started_at = COALESCE(started_at, NOW()), finished_at = NULL
       WHERE id = $1`,
      [operationId],
    );
    const tenant = await openTenantDbByName(row.tenant_db_name);
    await applyAppSchema(tenant, row.target_definition);

    const client = await core.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE public.apps
         SET template_revision_id = $3, schema_revision = $4,
             runtime_error_detail = NULL
         WHERE id = $1 AND template_revision_id = $2`,
        [appId, row.source_revision_id, row.target_revision_id, row.target_digest],
      );
      if (updated.rowCount !== 1) {
        throw new TemplateAppRevisionError("revision_race", "App revision เปลี่ยนระหว่าง operation");
      }
      await client.query(
        `UPDATE public.app_operations
         SET status = 'COMPLETED', checkpoint = 'REVISION_ACTIVE',
             result = result || $2::jsonb, finished_at = NOW()
         WHERE id = $1`,
        [operationId, JSON.stringify({ revision: row.target_digest })],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return {
      appId,
      operationId,
      revisionId: row.target_revision_id,
      revision: row.target_digest,
      reused: false,
    };
  } catch (error) {
    await core.query(
      `UPDATE public.app_operations
       SET status = 'FAILED', checkpoint = 'FAILED', error_detail = $2,
           finished_at = NOW()
       WHERE id = $1`,
      [operationId, error instanceof Error ? error.message : "Revision update failed"],
    ).catch(() => undefined);
    throw error;
  }
}
