import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import type { TemplateDefinition } from "@/lib/template/contracts";
import { createPublicTemplateExport } from "@/lib/template/publicTemplateExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublicTemplateRow {
  template_slug: string;
  template_name: string;
  description: string | null;
  revision_number: string;
  revision_digest: string;
  compiled_definition: TemplateDefinition;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const result = await getCoreDb().query<PublicTemplateRow>(
      `SELECT template.template_slug, template.template_name, template.description,
              revision.revision_number, revision.revision_digest, revision.compiled_definition
       FROM public.templates template
       JOIN public.template_revisions revision
         ON revision.id = template.published_revision_id
        AND revision.template_id = template.id
       WHERE template.id = $1
         AND template.is_public = true
         AND template.archived_at IS NULL`,
      [id],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "ไม่พบ Public Template ที่เผยแพร่แล้ว" }, { status: 404 });
    }
    const row = result.rows[0];
    return NextResponse.json({
      export: createPublicTemplateExport({
        slug: row.template_slug,
        name: row.template_name,
        description: row.description,
        revision: Number(row.revision_number),
        digest: row.revision_digest,
        definition: row.compiled_definition,
      }),
    }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Unable to export public Template", error);
    return NextResponse.json({ error: "ไม่สามารถ Export Public Template ได้" }, { status: 500 });
  }
}
