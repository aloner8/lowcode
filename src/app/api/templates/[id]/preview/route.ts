import { NextResponse } from "next/server";
import { requireApiSession, requireTemplateAccess } from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";
import {
  compileTemplateDefinition,
  type CompilableObjectRow,
  type CompilableScreenPageRow,
  type CompilableTemplateRow,
} from "@/lib/template/compileTemplateDefinition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;
  const denied = await requireTemplateAccess(auth, templateId, "VIEWER");
  if (denied) return denied;

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const template = await client.query<CompilableTemplateRow>(
      `SELECT id, customer_id, template_name, edit_version
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
    );
    await client.query("COMMIT");
    if (compiled.issues.length) {
      return NextResponse.json(
        { error: "Template preview validation failed", issues: compiled.issues },
        { status: 422 },
      );
    }

    // The browser never receives the server-owned connection selector.
    delete compiled.definition.startup.connectionProfileRef;
    return NextResponse.json({
      preview: true,
      editVersion: compiled.definition.template.editVersion,
      definition: compiled.definition,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to compile Template preview", error);
    return NextResponse.json({ error: "ไม่สามารถสร้าง Preview ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}
