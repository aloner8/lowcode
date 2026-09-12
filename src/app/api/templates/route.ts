import { NextResponse } from "next/server";
import {
  isGod,
  requireApiSession,
  requireCustomerAccess,
} from "@/lib/auth/apiAuth";
import { getCoreDb } from "@/lib/db/coreDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TemplateRow {
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

const selectTemplates = `
  SELECT template.id, template.customer_id, template.template_slug,
         template.template_name, template.description, template.is_public,
         template.edit_version, template.published_revision_id,
         template.legacy_platform_id, template.created_at, template.updated_at
  FROM public.templates template
`;

const toTemplate = (row: TemplateRow) => ({
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

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const customerId = new URL(request.url).searchParams.get("customerId");
  try {
    const result = isGod(auth.role)
      ? await getCoreDb().query<TemplateRow>(
          `${selectTemplates}
           WHERE template.archived_at IS NULL
             AND ($1::uuid IS NULL OR template.customer_id = $1)
           ORDER BY template.updated_at DESC`,
          [customerId],
        )
      : await getCoreDb().query<TemplateRow>(
          `${selectTemplates}
           JOIN public.customer_memberships membership
             ON membership.customer_id = template.customer_id
            AND membership.user_id = $1
           JOIN public.customers customer
             ON customer.id = template.customer_id AND customer.status = 'ACTIVE'
           WHERE template.archived_at IS NULL
             AND ($2::uuid IS NULL OR template.customer_id = $2)
           ORDER BY template.updated_at DESC`,
          [auth.sub, customerId],
        );
    return NextResponse.json({ templates: result.rows.map(toTemplate) });
  } catch (error) {
    console.error("Unable to list templates", error);
    return NextResponse.json({ error: "ไม่สามารถอ่าน Template ได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
    const templateSlug = typeof body.templateSlug === "string"
      ? body.templateSlug.trim().toLowerCase()
      : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!customerId || !templateName || !templateSlug) {
      return NextResponse.json(
        { error: "ต้องระบุ Customer, ชื่อ และ Slug ของ Template" },
        { status: 400 },
      );
    }
    if (templateName.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateSlug)) {
      return NextResponse.json({ error: "ชื่อหรือ Slug ของ Template ไม่ถูกต้อง" }, { status: 400 });
    }

    const denied = await requireCustomerAccess(auth, customerId, "EDITOR");
    if (denied) return denied;

    const result = await getCoreDb().query<TemplateRow>(
      `INSERT INTO public.templates (
         customer_id, template_slug, template_name, description, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, customer_id, template_slug, template_name, description,
                 is_public, edit_version, published_revision_id,
                 legacy_platform_id, created_at, updated_at`,
      [customerId, templateSlug, templateName, description || null, auth.sub],
    );
    return NextResponse.json({ template: toTemplate(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "Template Slug นี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Unable to create template", error);
    return NextResponse.json({ error: "ไม่สามารถสร้าง Template ได้" }, { status: 500 });
  }
}
