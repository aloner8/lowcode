import { NextResponse } from "next/server";
import { requireApiSession, requireSiteAccess } from "@/lib/auth/apiAuth";
import {
  applyTemplateAppRevisionUpdate,
  registerTemplateAppRevisionUpdate,
  TemplateAppRevisionError,
} from "@/lib/db/templateAppRevision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id: appId } = await context.params;
  const denied = await requireSiteAccess(auth, appId, "ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const revisionId = typeof input.revisionId === "string" ? input.revisionId.trim() : "";
    const operationKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!revisionId) {
      return NextResponse.json({ error: "ต้องระบุ revisionId" }, { status: 400 });
    }
    if (!operationKey || operationKey.length > 180) {
      return NextResponse.json({ error: "ต้องส่ง Idempotency-Key" }, { status: 400 });
    }

    const registration = await registerTemplateAppRevisionUpdate({
      actorId: auth.sub,
      appId,
      revisionId,
      operationKey,
    });
    const result = await applyTemplateAppRevisionUpdate(appId, registration.operationId);
    return NextResponse.json({
      ...result,
      reused: registration.reused || result.reused,
    });
  } catch (error) {
    if (error instanceof TemplateAppRevisionError) {
      const status = error.code === "operation_not_found" || error.code === "app_not_template_managed"
        ? 404
        : error.code === "revision_not_found"
          ? 400
          : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const dbError = error as { code?: string };
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "Idempotency-Key ถูกใช้แล้ว" }, { status: 409 });
    }
    console.error("Unable to update Template App revision", error);
    return NextResponse.json({ error: "ไม่สามารถอัปเดต App revision ได้" }, { status: 500 });
  }
}
