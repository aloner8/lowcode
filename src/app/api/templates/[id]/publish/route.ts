import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  requireApiSession,
  requireTemplateAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";
import {
  compileTemplateDefinition,
  stableStringify,
  type CompilableObjectRow,
  type CompilableScreenPageRow,
  type CompilableTemplateRow,
} from "@/lib/template/compileTemplateDefinition";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { diffTemplateRevisions } from "@/lib/template/templateRevisionDiff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevisionRow {
  id: string;
  revision_number: string;
  revision_digest: string;
  schema_version: string;
  source_edit_version: string;
  published_at: Date;
}

interface PublishedRevisionRow extends RevisionRow {
  compiled_definition: TemplateDefinition;
}

const revisionDigest = (definition: TemplateDefinition) => {
  const digestInput = structuredClone(definition);
  delete digestInput.template.revision;
  return createHash("sha256")
    .update(stableStringify(digestInput))
    .digest("hex");
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;
  const denied = await requireTemplateAccess(auth, templateId, "EDITOR");
  if (denied) return denied;

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const template = await client.query<CompilableTemplateRow & { published_revision_id: string | null }>(
      `SELECT id, customer_id, template_name, edit_version, published_revision_id
       FROM public.templates
       WHERE id = $1 AND archived_at IS NULL`,
      [templateId],
    );
    if (!template.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบ Template" }, { status: 404 });
    }
    const objects = await client.query<CompilableObjectRow>(
      `SELECT id, object_type, object_key, object_name, definition
       FROM public.template_objects
       WHERE template_id = $1
       ORDER BY object_type, object_key, id`,
      [templateId],
    );
    const screenPages = await client.query<CompilableScreenPageRow>(
      `SELECT screen.object_key AS screen_key,
              page.object_key AS page_key,
              relation.sort_order,
              relation.is_default
       FROM public.template_screen_pages relation
       JOIN public.template_objects screen
         ON screen.template_id = relation.template_id
        AND screen.id = relation.screen_object_id
       JOIN public.template_objects page
         ON page.template_id = relation.template_id
        AND page.id = relation.page_object_id
       WHERE relation.template_id = $1
       ORDER BY screen.object_key, relation.sort_order, relation.id`,
      [templateId],
    );
    const compiled = compileTemplateDefinition(
      template.rows[0],
      objects.rows,
      screenPages.rows,
      "pending",
    );
    const digest = revisionDigest(compiled.definition);
    compiled.definition.template.revision = digest;

    const published = template.rows[0].published_revision_id
      ? await client.query<PublishedRevisionRow>(
          `SELECT id, revision_number, revision_digest, schema_version,
                  source_edit_version, published_at, compiled_definition
           FROM public.template_revisions
           WHERE template_id = $1 AND id = $2`,
          [templateId, template.rows[0].published_revision_id],
        )
      : { rowCount: 0, rows: [] as PublishedRevisionRow[] };
    await client.query("COMMIT");

    const current = published.rows[0] ?? null;
    return NextResponse.json({
      review: {
        canPublish: compiled.issues.length === 0,
        issues: compiled.issues,
        draft: {
          editVersion: Number(template.rows[0].edit_version),
          digest,
        },
        published: current ? {
          id: current.id,
          number: Number(current.revision_number),
          digest: current.revision_digest,
          schemaVersion: current.schema_version,
          sourceEditVersion: Number(current.source_edit_version),
          publishedAt: current.published_at.toISOString(),
        } : null,
        diff: diffTemplateRevisions(current?.compiled_definition ?? null, compiled.definition),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to review Template publish", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบก่อน Publish ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;

  const denied = await requireTemplateAccess(auth, templateId, "EDITOR");
  if (denied) return denied;
  const body = await request.json().catch(() => ({})) as { expectedEditVersion?: unknown };
  const expectedEditVersion = Number.isInteger(body.expectedEditVersion)
    ? Number(body.expectedEditVersion)
    : null;

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const access = await client.query<{ role_rank: number }>(
      `SELECT public.customer_role_rank(
         public.template_role_of($1, $2)
       ) AS role_rank`,
      [auth.sub, templateId],
    );
    if ((access.rows[0]?.role_rank ?? -1) < 1) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่มีสิทธิ์ Publish Template นี้" }, { status: 403 });
    }

    const template = await client.query<CompilableTemplateRow>(
      `SELECT id, customer_id, template_name, edit_version
       FROM public.templates
       WHERE id = $1 AND archived_at IS NULL
       FOR UPDATE`,
      [templateId],
    );
    if (!template.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบ Template" }, { status: 404 });
    }
    if (
      expectedEditVersion !== null &&
      Number(template.rows[0].edit_version) !== expectedEditVersion
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Template ถูกแก้ไขหลังเปิดหน้าตรวจ Publish กรุณาตรวจอีกครั้ง",
          expectedEditVersion,
          actualEditVersion: Number(template.rows[0].edit_version),
        },
        { status: 409 },
      );
    }

    const objects = await client.query<CompilableObjectRow>(
      `SELECT id, object_type, object_key, object_name, definition
       FROM public.template_objects
       WHERE template_id = $1
       ORDER BY object_type, object_key, id`,
      [templateId],
    );
    const screenPages = await client.query<CompilableScreenPageRow>(
      `SELECT screen.object_key AS screen_key,
              page.object_key AS page_key,
              relation.sort_order,
              relation.is_default
       FROM public.template_screen_pages relation
       JOIN public.template_objects screen
         ON screen.template_id = relation.template_id
        AND screen.id = relation.screen_object_id
       JOIN public.template_objects page
         ON page.template_id = relation.template_id
        AND page.id = relation.page_object_id
       WHERE relation.template_id = $1
       ORDER BY screen.object_key, relation.sort_order, relation.id`,
      [templateId],
    );

    const compiled = compileTemplateDefinition(
      template.rows[0],
      objects.rows,
      screenPages.rows,
      "pending",
    );
    if (compiled.issues.length) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Template validation failed", issues: compiled.issues },
        { status: 422 },
      );
    }

    const digest = revisionDigest(compiled.definition);
    compiled.definition.template.revision = digest;

    const existing = await client.query<RevisionRow>(
      `SELECT id, revision_number, revision_digest, schema_version,
              source_edit_version, published_at
       FROM public.template_revisions
       WHERE template_id = $1 AND revision_digest = $2`,
      [templateId, digest],
    );
    let revision: RevisionRow;
    let reused = false;
    if (existing.rowCount) {
      revision = existing.rows[0];
      reused = true;
    } else {
      const nextRevision = await client.query<{ revision_number: string }>(
        `SELECT (COALESCE(MAX(revision_number), 0) + 1)::text AS revision_number
         FROM public.template_revisions
         WHERE template_id = $1`,
        [templateId],
      );
      const inserted = await client.query<RevisionRow>(
        `INSERT INTO public.template_revisions (
           id, template_id, revision_number, revision_digest, schema_version,
           source_edit_version, compiled_definition, published_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING id, revision_number, revision_digest, schema_version,
                   source_edit_version, published_at`,
        [
          randomUUID(),
          templateId,
          nextRevision.rows[0].revision_number,
          digest,
          compiled.definition.schemaVersion,
          compiled.definition.template.editVersion,
          JSON.stringify(compiled.definition),
          auth.sub,
        ],
      );
      revision = inserted.rows[0];
    }

    await client.query(
      `UPDATE public.templates
       SET published_revision_id = $2, updated_by = $3
       WHERE id = $1`,
      [templateId, revision.id, auth.sub],
    );
    await client.query("COMMIT");
    return NextResponse.json({
      revision: {
        id: revision.id,
        number: Number(revision.revision_number),
        digest: revision.revision_digest,
        schemaVersion: revision.schema_version,
        sourceEditVersion: Number(revision.source_edit_version),
        publishedAt: revision.published_at.toISOString(),
        reused,
      },
      definition: compiled.definition,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to publish template", error);
    return NextResponse.json({ error: "ไม่สามารถ Publish Template ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}
