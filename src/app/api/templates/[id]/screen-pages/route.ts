import { NextResponse } from "next/server";
import { requireApiSession, requireTemplateAccess } from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScreenPageRow {
  id: string;
  screen_object_id: string;
  screen_key: string;
  page_object_id: string;
  page_key: string;
  sort_order: number;
  is_default: boolean;
}

const selectRelations = `
  SELECT relation.id, relation.screen_object_id, screen.object_key AS screen_key,
         relation.page_object_id, page.object_key AS page_key,
         relation.sort_order, relation.is_default
  FROM public.template_screen_pages relation
  JOIN public.template_objects screen
    ON screen.template_id = relation.template_id
   AND screen.id = relation.screen_object_id
  JOIN public.template_objects page
    ON page.template_id = relation.template_id
   AND page.id = relation.page_object_id
  WHERE relation.template_id = $1
`;

const toRelation = (row: ScreenPageRow) => ({
  id: row.id,
  screenObjectId: row.screen_object_id,
  screenKey: row.screen_key,
  pageObjectId: row.page_object_id,
  pageKey: row.page_key,
  sortOrder: row.sort_order,
  isDefault: row.is_default,
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;
  const denied = await requireTemplateAccess(auth, templateId, "VIEWER");
  if (denied) return denied;

  const result = await getCoreDb().query<ScreenPageRow>(
    `${selectRelations} ORDER BY screen.object_key, relation.sort_order, relation.id`,
    [templateId],
  );
  return NextResponse.json({ screenPages: result.rows.map(toRelation) });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;
  const denied = await requireTemplateAccess(auth, templateId, "EDITOR");
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  const screenObjectId = typeof body.screenObjectId === "string" ? body.screenObjectId : "";
  const expectedTemplateEditVersion = typeof body.expectedTemplateEditVersion === "number"
    ? body.expectedTemplateEditVersion
    : -1;
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const normalized = pages.map((item, index) => {
    const value = item as Record<string, unknown>;
    return {
      pageObjectId: typeof value.pageObjectId === "string" ? value.pageObjectId : "",
      sortOrder: Number.isInteger(value.sortOrder) ? Number(value.sortOrder) : index,
      isDefault: value.isDefault === true,
    };
  });

  if (!screenObjectId || expectedTemplateEditVersion < 1) {
    return NextResponse.json({ error: "Screen หรือ edit version ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!normalized.length || normalized.some((page) => !page.pageObjectId)) {
    return NextResponse.json({ error: "Screen ต้องมี Page อย่างน้อยหนึ่งรายการ" }, { status: 400 });
  }
  if (new Set(normalized.map((page) => page.pageObjectId)).size !== normalized.length) {
    return NextResponse.json({ error: "มี Page ซ้ำใน Screen" }, { status: 400 });
  }
  if (normalized.filter((page) => page.isDefault).length !== 1) {
    return NextResponse.json({ error: "ต้องเลือก Default Page หนึ่งรายการ" }, { status: 400 });
  }

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const access = await client.query<{ role_rank: number }>(
      `SELECT public.customer_role_rank(public.template_role_of($1, $2)) AS role_rank`,
      [auth.sub, templateId],
    );
    if ((access.rows[0]?.role_rank ?? -1) < 1) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไข Template นี้" }, { status: 403 });
    }

    const locked = await client.query(
      `SELECT id FROM public.templates
       WHERE id = $1 AND edit_version = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [templateId, expectedTemplateEditVersion],
    );
    if (!locked.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Template ถูกแก้จากที่อื่นแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }

    const validObjects = await client.query<{ id: string; object_type: string }>(
      `SELECT id, object_type FROM public.template_objects
       WHERE template_id = $1 AND id = ANY($2::uuid[])`,
      [templateId, [screenObjectId, ...normalized.map((page) => page.pageObjectId)]],
    );
    const typeById = new Map(validObjects.rows.map((row) => [row.id, row.object_type]));
    if (
      typeById.get(screenObjectId) !== "SCREEN" ||
      normalized.some((page) => typeById.get(page.pageObjectId) !== "PAGE")
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Screen/Page ไม่ได้อยู่ใน Template นี้" }, { status: 400 });
    }

    await client.query(
      `DELETE FROM public.template_screen_pages
       WHERE template_id = $1 AND screen_object_id = $2`,
      [templateId, screenObjectId],
    );
    for (const page of normalized) {
      await client.query(
        `INSERT INTO public.template_screen_pages (
           template_id, screen_object_id, page_object_id, sort_order, is_default
         ) VALUES ($1, $2, $3, $4, $5)`,
        [templateId, screenObjectId, page.pageObjectId, page.sortOrder, page.isDefault],
      );
    }
    await client.query(
      `UPDATE public.templates
       SET edit_version = edit_version + 1, updated_by = $2
       WHERE id = $1`,
      [templateId, auth.sub],
    );
    const result = await client.query<ScreenPageRow>(
      `${selectRelations}
       AND relation.screen_object_id = $2
       ORDER BY relation.sort_order, relation.id`,
      [templateId, screenObjectId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ screenPages: result.rows.map(toRelation) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to save Screen/Page relationships", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึก Screen/Page ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}
