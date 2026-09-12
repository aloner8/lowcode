import { NextResponse } from "next/server";
import {
  getAppTenantRecord,
  TenantRecordError,
  updateAppTenantRecord,
} from "@/lib/db/tenantRecords";
import { clientIdentity, enforceRateLimit } from "@/lib/security/rateLimit";
import { resolveCollection } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ slug: string; collectionId: string; recordId: string }>;
};

const failure = (error: unknown) => {
  if (error instanceof TenantRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("App api/db record access failed", error);
  return NextResponse.json({ error: "ไม่สามารถดำเนินการกับข้อมูลได้" }, { status: 500 });
};

export async function GET(request: Request, context: Context) {
  const { slug, collectionId, recordId } = await context.params;
  const limited = await enforceRateLimit(
    "public_read",
    clientIdentity(request, `${slug}:${collectionId}:${recordId}`),
  );
  if (limited) return limited;

  const resolved = await resolveCollection(slug, collectionId);
  if (!resolved) {
    return NextResponse.json({ error: "ไม่พบ App หรือ Collection" }, { status: 404 });
  }
  if (!resolved.collection.access?.publicRead) {
    return NextResponse.json({ error: "Collection นี้ไม่ได้เปิดให้อ่านแบบสาธารณะ" }, { status: 403 });
  }

  try {
    const record = await getAppTenantRecord(
      resolved.appId,
      resolved.collection.tableName,
      recordId,
    );
    return NextResponse.json({ record });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const { slug, collectionId, recordId } = await context.params;
  const limited = await enforceRateLimit(
    "public_write",
    clientIdentity(request, `${slug}:${collectionId}:${recordId}`),
    "แก้ไขข้อมูลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  );
  if (limited) return limited;

  const resolved = await resolveCollection(slug, collectionId);
  if (!resolved) {
    return NextResponse.json({ error: "ไม่พบ App หรือ Collection" }, { status: 404 });
  }
  if (!resolved.collection.access?.publicUpdate) {
    return NextResponse.json({ error: "Collection นี้ไม่ได้เปิดให้แก้ไขแบบสาธารณะ" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const record = await updateAppTenantRecord(
      resolved.appId,
      resolved.collection.tableName,
      recordId,
      body,
    );
    return NextResponse.json({ record });
  } catch (error) {
    return failure(error);
  }
}
