import { NextResponse } from "next/server";
import {
  requireApiSession,
  requireTemplateAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TemplateDetailRow {
  id: string;
  customer_id: string;
  template_slug: string;
  template_name: string;
  description: string | null;
  is_public: boolean;
  edit_version: string;
  published_revision_id: string | null;
  legacy_platform_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const selectTemplate = `
  SELECT id, customer_id, template_slug, template_name, description, is_public,
         edit_version, published_revision_id, legacy_platform_id, created_at, updated_at
  FROM public.templates
  WHERE id = $1 AND archived_at IS NULL
`;

const toTemplate = (row: TemplateDetailRow) => ({
  id: row.id,
  customerId: row.customer_id,
  templateSlug: row.template_slug,
  templateName: row.template_name,
  description: row.description,
  isPublic: row.is_public,
  editVersion: Number(row.edit_version),
  publishedRevisionId: row.published_revision_id,
  legacyPlatformId: row.legacy_platform_id,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const denied = await requireTemplateAccess(auth, id, "VIEWER");
  if (denied) return denied;

  const result = await getCoreDb().query<TemplateDetailRow>(selectTemplate, [id]);
  if (!result.rowCount) {
    return NextResponse.json({ error: "ไม่พบ Template" }, { status: 404 });
  }
  return NextResponse.json({ template: toTemplate(result.rows[0]) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const denied = await requireTemplateAccess(auth, id, "EDITOR");
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const expectedEditVersion = typeof body.expectedEditVersion === "number"
      ? body.expectedEditVersion
      : -1;
    if (!Number.isInteger(expectedEditVersion) || expectedEditVersion < 1) {
      return NextResponse.json({ error: "expectedEditVersion ไม่ถูกต้อง" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: unknown[] = [id, expectedEditVersion, auth.sub];
    if (typeof body.templateName === "string" && body.templateName.trim()) {
      params.push(body.templateName.trim());
      updates.push(`template_name = $${params.length}`);
    }
    if (typeof body.description === "string") {
      params.push(body.description.trim() || null);
      updates.push(`description = $${params.length}`);
    }
    if (typeof body.isPublic === "boolean") {
      params.push(body.isPublic);
      updates.push(`is_public = $${params.length}`);
    }
    if (!updates.length) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    }

    const result = await getCoreDb().query<TemplateDetailRow>(
      `UPDATE public.templates
       SET ${updates.join(", ")}, edit_version = edit_version + 1, updated_by = $3
       WHERE id = $1 AND edit_version = $2 AND archived_at IS NULL
       RETURNING id, customer_id, template_slug, template_name, description,
                 is_public, edit_version, published_revision_id,
                 legacy_platform_id, created_at, updated_at`,
      params,
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Template ถูกแก้จากที่อื่นแล้ว กรุณาโหลดข้อมูลใหม่", code: "EDIT_CONFLICT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ template: toTemplate(result.rows[0]) });
  } catch (error) {
    console.error("Unable to update template", error);
    return NextResponse.json({ error: "ไม่สามารถแก้ไข Template ได้" }, { status: 500 });
  }
}
