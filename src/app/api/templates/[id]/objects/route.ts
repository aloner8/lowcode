import { NextResponse } from "next/server";
import {
  requireApiSession,
  requireTemplateAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";
import {
  componentPlacementKey,
  placementOf,
  type StudioComponentPlacement,
} from "@/lib/template/studioEditing";

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

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

const placementMatches = (
  definition: Record<string, unknown>,
  placement: StudioComponentPlacement,
) => componentPlacementKey(definition) === componentPlacementKey(placement);

const updateScreenRegionReferences = (
  definition: Record<string, unknown>,
  regionKey: string,
  componentKeys: string[],
): Record<string, unknown> => {
  const regions = Array.isArray(definition.regions) ? definition.regions : [];
  return {
    ...definition,
    regions: regions.map((value) => {
      const region = record(value);
      return region.key === regionKey
        ? { ...region, componentInstanceIds: componentKeys }
        : region;
    }),
  };
};

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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;

  const denied = await requireTemplateAccess(auth, templateId, "EDITOR");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const placement = placementOf(record(body?.placement));
  const rawEntries = Array.isArray(body?.objects) ? body.objects : [];
  const entries = rawEntries.map((value) => {
    const entry = record(value);
    return {
      objectId: typeof entry.objectId === "string" ? entry.objectId : "",
      expectedEditVersion: typeof entry.expectedEditVersion === "number"
        ? entry.expectedEditVersion
        : -1,
    };
  });
  const orderedIds = entries.map((entry) => entry.objectId);
  if (
    !placement ||
    entries.length === 0 ||
    entries.length > 500 ||
    entries.some((entry) => !entry.objectId || !Number.isInteger(entry.expectedEditVersion) || entry.expectedEditVersion < 1) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return NextResponse.json({ error: "ลำดับ Component ไม่ถูกต้อง" }, { status: 400 });
  }

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    const template = await client.query(
      "SELECT id FROM public.templates WHERE id = $1 FOR UPDATE",
      [templateId],
    );
    if (!template.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบ Template" }, { status: 404 });
    }

    const result = await client.query<TemplateObjectRow>(
      `SELECT id, template_id, object_type, object_key, object_name, edit_version,
              definition, created_at, updated_at
       FROM public.template_objects
       WHERE template_id = $1 AND object_type = 'COMPONENT_INSTANCE'
       FOR UPDATE`,
      [templateId],
    );
    const siblings = result.rows.filter((row) => placementMatches(row.definition, placement));
    if (!sameIds(orderedIds, siblings.map((row) => row.id))) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "รายการ Component เปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }
    const byId = new Map(siblings.map((row) => [row.id, row]));
    if (entries.some((entry) => Number(byId.get(entry.objectId)?.edit_version) !== entry.expectedEditVersion)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Component ถูกแก้จากที่อื่นแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }

    const saved: TemplateObjectRow[] = [];
    for (const [loadOrder, entry] of entries.entries()) {
      const updated = await client.query<TemplateObjectRow>(
        `UPDATE public.template_objects
         SET definition = jsonb_set(definition, '{loadOrder}', to_jsonb($3::integer), true),
             edit_version = edit_version + 1,
             updated_by = $4
         WHERE template_id = $1 AND id = $2
         RETURNING id, template_id, object_type, object_key, object_name,
                   edit_version, definition, created_at, updated_at`,
        [templateId, entry.objectId, loadOrder, auth.sub],
      );
      saved.push(updated.rows[0]);
    }

    if (placement.placement === "screen_region") {
      const screenResult = await client.query<TemplateObjectRow>(
        `SELECT id, template_id, object_type, object_key, object_name, edit_version,
                definition, created_at, updated_at
         FROM public.template_objects
         WHERE template_id = $1 AND object_type = 'SCREEN' AND object_key = $2
         FOR UPDATE`,
        [templateId, placement.screenId],
      );
      const screen = screenResult.rows[0];
      if (screen) {
        const componentKeys = orderedIds.map((id) => byId.get(id)!.object_key);
        await client.query(
          `UPDATE public.template_objects
           SET definition = $3::jsonb, edit_version = edit_version + 1, updated_by = $4
           WHERE template_id = $1 AND id = $2`,
          [
            templateId,
            screen.id,
            JSON.stringify(updateScreenRegionReferences(screen.definition, placement.region, componentKeys)),
            auth.sub,
          ],
        );
      }
    }

    await client.query(
      "UPDATE public.templates SET edit_version = edit_version + 1, updated_by = $2 WHERE id = $1",
      [templateId, auth.sub],
    );
    await client.query("COMMIT");
    return NextResponse.json({ objects: saved.map(toObject) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to reorder template components", error);
    return NextResponse.json({ error: "ไม่สามารถจัดลำดับ Component ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: templateId } = await context.params;

  const denied = await requireTemplateAccess(auth, templateId, "EDITOR");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const objectId = typeof body?.objectId === "string" ? body.objectId : "";
  const expectedEditVersion = typeof body?.expectedEditVersion === "number"
    ? body.expectedEditVersion
    : -1;
  if (!objectId || !Number.isInteger(expectedEditVersion) || expectedEditVersion < 1) {
    return NextResponse.json({ error: "ข้อมูล Component ไม่ถูกต้อง" }, { status: 400 });
  }

  const client = await getCoreDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM public.templates WHERE id = $1 FOR UPDATE", [templateId]);
    const result = await client.query<TemplateObjectRow>(
      `SELECT id, template_id, object_type, object_key, object_name, edit_version,
              definition, created_at, updated_at
       FROM public.template_objects
       WHERE template_id = $1 AND id = $2
       FOR UPDATE`,
      [templateId, objectId],
    );
    const object = result.rows[0];
    if (!object) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบ Component" }, { status: 404 });
    }
    if (object.object_type !== "COMPONENT_INSTANCE") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ลบผ่านหน้าจอนี้ได้เฉพาะ Component instance" }, { status: 400 });
    }
    if (Number(object.edit_version) !== expectedEditVersion) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Component ถูกแก้จากที่อื่นแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }

    const placement = placementOf(object.definition);
    if (placement?.placement === "screen_region") {
      const screenResult = await client.query<TemplateObjectRow>(
        `SELECT id, template_id, object_type, object_key, object_name, edit_version,
                definition, created_at, updated_at
         FROM public.template_objects
         WHERE template_id = $1 AND object_type = 'SCREEN' AND object_key = $2
         FOR UPDATE`,
        [templateId, placement.screenId],
      );
      const screen = screenResult.rows[0];
      if (screen) {
        const regions = Array.isArray(screen.definition.regions) ? screen.definition.regions : [];
        const currentRegion = regions.map(record).find((region) => region.key === placement.region);
        const componentKeys = Array.isArray(currentRegion?.componentInstanceIds)
          ? currentRegion.componentInstanceIds.filter((key): key is string => typeof key === "string" && key !== object.object_key)
          : [];
        await client.query(
          `UPDATE public.template_objects
           SET definition = $3::jsonb, edit_version = edit_version + 1, updated_by = $4
           WHERE template_id = $1 AND id = $2`,
          [
            templateId,
            screen.id,
            JSON.stringify(updateScreenRegionReferences(screen.definition, placement.region, componentKeys)),
            auth.sub,
          ],
        );
      }
    }

    await client.query(
      "DELETE FROM public.template_objects WHERE template_id = $1 AND id = $2",
      [templateId, objectId],
    );
    await client.query(
      "UPDATE public.templates SET edit_version = edit_version + 1, updated_by = $2 WHERE id = $1",
      [templateId, auth.sub],
    );
    await client.query("COMMIT");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to delete template component", error);
    return NextResponse.json({ error: "ไม่สามารถลบ Component ได้" }, { status: 500 });
  } finally {
    client.release();
  }
}
