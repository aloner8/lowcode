import { NextResponse } from "next/server";
import {
  requireApiSession,
  requireTemplateAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT_TYPES = [
  "STARTUP",
  "MODULE",
  "ROUTE",
  "SCREEN",
  "PAGE",
  "COMPONENT",
  "COMPONENT_INSTANCE",
  "COLLECTION",
  "MENU",
  "POPUP",
] as const;

type TemplateObjectType = (typeof OBJECT_TYPES)[number];

interface TemplateObjectRow {
  id: string;
  template_id: string;
  object_type: TemplateObjectType;
  object_key: string;
  object_name: string;
  edit_version: string;
  definition: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const toObject = (row: TemplateObjectRow) => ({
  id: row.id,
  templateId: row.template_id,
  objectType: row.object_type,
  objectKey: row.object_key,
  objectName: row.object_name,
  editVersion: Number(row.edit_version),
  definition: row.definition,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const denied = await requireTemplateAccess(auth, id, "VIEWER");
  if (denied) return denied;

  const rawType = new URL(request.url).searchParams.get("type")?.toUpperCase();
  if (rawType && !OBJECT_TYPES.includes(rawType as TemplateObjectType)) {
    return NextResponse.json({ error: "Object type ไม่ถูกต้อง" }, { status: 400 });
  }

  const result = await getCoreDb().query<TemplateObjectRow>(
    `SELECT id, template_id, object_type, object_key, object_name, edit_version,
            definition, created_at, updated_at
     FROM public.template_objects
     WHERE template_id = $1 AND ($2::text IS NULL OR object_type = $2)
     ORDER BY object_type, object_name, id`,
    [id, rawType || null],
  );
  return NextResponse.json({ objects: result.rows.map(toObject) });
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

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const objectId = typeof body.objectId === "string" ? body.objectId : null;
    const objectType = typeof body.objectType === "string" ? body.objectType.toUpperCase() : "";
    const objectKey = typeof body.objectKey === "string" ? body.objectKey.trim() : "";
    const objectName = typeof body.objectName === "string" ? body.objectName.trim() : "";
    const definition = body.definition;
    const expectedEditVersion = typeof body.expectedEditVersion === "number"
      ? body.expectedEditVersion
      : -1;

    if (!OBJECT_TYPES.includes(objectType as TemplateObjectType)) {
      return NextResponse.json({ error: "Object type ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!objectKey || !objectName || objectKey.length > 180 || objectName.length > 255) {
      return NextResponse.json({ error: "Object key หรือชื่อไม่ถูกต้อง" }, { status: 400 });
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      return NextResponse.json({ error: "definition ต้องเป็น JSON object" }, { status: 400 });
    }
    if (!Number.isInteger(expectedEditVersion) || expectedEditVersion < 0) {
      return NextResponse.json({ error: "expectedEditVersion ไม่ถูกต้อง" }, { status: 400 });
    }
    if ((objectId === null) !== (expectedEditVersion === 0)) {
      return NextResponse.json(
        { error: "Object ใหม่ต้องใช้ expectedEditVersion 0; Object เดิมต้องส่ง objectId" },
        { status: 400 },
      );
    }

    const result = await getCoreDb().query<TemplateObjectRow>(
      `SELECT * FROM public.save_template_object(
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8
       )`,
      [
        auth.sub,
        templateId,
        objectId,
        objectType,
        objectKey,
        objectName,
        JSON.stringify(definition),
        expectedEditVersion,
      ],
    );
    return NextResponse.json(
      { object: toObject(result.rows[0]) },
      { status: objectId ? 200 : 201 },
    );
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "40001") {
      return NextResponse.json(
        { error: "Object ถูกแก้จากที่อื่นแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }
    if (dbError.code === "42501") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไข Template นี้" }, { status: 403 });
    }
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "Object key นี้มีอยู่แล้ว" }, { status: 409 });
    }
    if (dbError.code === "22023" || dbError.code === "23514") {
      return NextResponse.json({ error: dbError.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    console.error("Unable to save template object", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึก Template Object ได้" }, { status: 500 });
  }
}
