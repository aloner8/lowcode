import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import {
  insertAppTenantRecord,
  listAppTenantRecords,
  TenantRecordError,
} from "@/lib/db/tenantRecords";
import { clientIdentity, enforceRateLimit } from "@/lib/security/rateLimit";
import type {
  CollectionDefinition,
  TemplateDefinition,
} from "@/lib/template/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ slug: string; collectionId: string }>;
};

interface AppCollectionContext {
  appId: string;
  collection: CollectionDefinition;
}

export async function resolveCollection(
  slug: string,
  collectionId: string,
): Promise<AppCollectionContext | null> {
  const result = await getCoreDb().query<{
    app_id: string;
    compiled_definition: TemplateDefinition;
  }>(
    `SELECT app.id AS app_id, revision.compiled_definition
     FROM public.apps app
     JOIN public.templates template ON template.id = app.template_id
     JOIN public.customers customer ON customer.id = template.customer_id
     JOIN public.template_revisions revision
       ON revision.id = app.template_revision_id
      AND revision.template_id = app.template_id
     WHERE app.app_slug = $1
       AND app.is_active = TRUE
       AND app.is_suspended = FALSE
       AND app.observed_state IN ('STOPPED', 'STARTING', 'RUNNING')
       AND customer.status = 'ACTIVE'
     LIMIT 1`,
    [slug],
  );
  if (!result.rowCount) return null;
  const collection = result.rows[0].compiled_definition.collections.find(
    (candidate) => candidate.id === collectionId,
  );
  return collection ? { appId: result.rows[0].app_id, collection } : null;
}

const failure = (error: unknown) => {
  if (error instanceof TenantRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("App api/db access failed", error);
  return NextResponse.json({ error: "ไม่สามารถดำเนินการกับข้อมูลได้" }, { status: 500 });
};

export async function GET(request: Request, context: Context) {
  const { slug, collectionId } = await context.params;
  const limited = await enforceRateLimit(
    "public_read",
    clientIdentity(request, `${slug}:${collectionId}`),
  );
  if (limited) return limited;

  const resolved = await resolveCollection(slug, collectionId);
  if (!resolved) {
    return NextResponse.json({ error: "ไม่พบ App หรือ Collection" }, { status: 404 });
  }
  if (!resolved.collection.access?.publicRead) {
    return NextResponse.json({ error: "Collection นี้ไม่ได้เปิดให้อ่านแบบสาธารณะ" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const requestedLimit = Number(params.get("limit") ?? 20);
  const requestedOffset = Number(params.get("offset") ?? 0);
  try {
    const page = await listAppTenantRecords(
      resolved.appId,
      resolved.collection.tableName,
      {
        limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20,
        offset: Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0,
        orderBy: params.get("orderBy") ?? undefined,
        direction: params.get("direction") === "asc" ? "asc" : "desc",
        search: params.get("search") ?? undefined,
      },
    );
    return NextResponse.json(page);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  const { slug, collectionId } = await context.params;
  const limited = await enforceRateLimit(
    "public_write",
    clientIdentity(request, `${slug}:${collectionId}`),
    "ส่งข้อมูลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  );
  if (limited) return limited;

  const resolved = await resolveCollection(slug, collectionId);
  if (!resolved) {
    return NextResponse.json({ error: "ไม่พบ App หรือ Collection" }, { status: 404 });
  }
  if (!resolved.collection.access?.publicCreate) {
    return NextResponse.json({ error: "Collection นี้ไม่ได้เปิดให้บันทึกแบบสาธารณะ" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const record = await insertAppTenantRecord(
      resolved.appId,
      resolved.collection.tableName,
      body,
    );
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
