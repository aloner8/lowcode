import { NextResponse } from "next/server";
import {
  requireApiSession,
  requireTemplateAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";
import { provisionTemplateAppDatabase } from "@/lib/db/templateAppProvisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisteredAppRow {
  registered_app_id: string;
  registered_operation_id: string;
  reused: boolean;
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
    const operationKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    const appName = typeof body.appName === "string" ? body.appName.trim() : "";
    const appSlug = typeof body.appSlug === "string" ? body.appSlug.trim().toLowerCase() : "";
    const subdomain = typeof body.subdomain === "string" ? body.subdomain.trim().toLowerCase() : "";
    const revisionId = typeof body.revisionId === "string" ? body.revisionId : null;
    const rawPort = typeof body.port === "number" ? body.port : null;

    if (!operationKey || operationKey.length > 180) {
      return NextResponse.json({ error: "ต้องส่ง Idempotency-Key" }, { status: 400 });
    }
    if (!appName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appSlug)) {
      return NextResponse.json({ error: "ชื่อหรือ Slug ของ App ไม่ถูกต้อง" }, { status: 400 });
    }
    if (rawPort !== null && (!Number.isInteger(rawPort) || rawPort < 1024 || rawPort > 65535)) {
      return NextResponse.json({ error: "Port ไม่ถูกต้อง" }, { status: 400 });
    }

    const registered = await getCoreDb().query<RegisteredAppRow>(
      `SELECT * FROM public.register_template_app(
         $1, $2, $3, $4, $5, $6, $7, $8
       )`,
      [
        auth.sub,
        templateId,
        revisionId,
        appName,
        appSlug,
        subdomain || null,
        rawPort,
        operationKey,
      ],
    );
    const row = registered.rows[0];
    const result = await provisionTemplateAppDatabase(
      row.registered_app_id,
      row.registered_operation_id,
    );
    return NextResponse.json(
      result,
      { status: row.reused ? 200 : 201 },
    );
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "42501") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์สร้าง App จาก Template นี้" }, { status: 403 });
    }
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "Slug, Domain หรือ Port นี้ถูกใช้แล้ว" }, { status: 409 });
    }
    if (dbError.code === "P0001") {
      return NextResponse.json({ error: dbError.message ?? "App quota exceeded" }, { status: 409 });
    }
    if (["22023", "23503", "P0002"].includes(dbError.code ?? "")) {
      return NextResponse.json({ error: dbError.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    console.error("Unable to create App from Template", error);
    return NextResponse.json({ error: "ไม่สามารถ Provision App ได้" }, { status: 500 });
  }
}
