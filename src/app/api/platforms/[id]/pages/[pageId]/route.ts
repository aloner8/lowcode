import { NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import { requirePlatformSession } from "@/lib/auth/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, pageId } = await context.params;
  const auth = await requirePlatformSession(id, "VIEWER");
  if (auth instanceof NextResponse) return auth;

  const result = await getCoreDb().query(
    `SELECT pp.page_config || jsonb_build_object(
       'id', pp.page_slug,
       'name', COALESCE(NULLIF(pp.page_config->>'name', ''), pp.title || ' (' || pp.page_slug || '.page)'),
       'title', pp.title,
       'componentTree', pp.component_tree,
       'isDefaultPage', pp.is_entry_page,
       'seo', pp.seo
     ) AS page,
     p.platform_name, p.platform_slug, p.master_theme_config
     FROM public.platform_pages pp
     JOIN public.platforms p ON p.id=pp.platform_id
     WHERE pp.platform_id=$1 AND pp.page_slug=$2`,
    [id, decodeURIComponent(pageId)],
  );
  if (!result.rowCount)
    return NextResponse.json(
      { error: "ไม่พบ Page ที่เลือกใน platform_pages" },
      { status: 404 },
    );
  return NextResponse.json({
    page: result.rows[0].page,
    platform: {
      id,
      platformName: result.rows[0].platform_name,
      platformSlug: result.rows[0].platform_slug,
      masterThemeConfig: result.rows[0].master_theme_config,
    },
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id, pageId } = await context.params;
  const auth = await requirePlatformSession(id, "STAFF");
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as { page?: Record<string, unknown> };
  if (!body.page || !Array.isArray(body.page.componentTree))
    return NextResponse.json(
      { error: "ข้อมูล Page ไม่ถูกต้อง" },
      { status: 400 },
    );

  const slug = decodeURIComponent(pageId);
  const title =
    typeof body.page.title === "string" && body.page.title.trim()
      ? body.page.title.trim()
      : slug;
  const pageConfig: Record<string, unknown> = { ...body.page, id: slug, title };
  delete pageConfig.componentTree;
  const result = await getCoreDb().query(
    `UPDATE public.platform_pages
     SET title=$3, component_tree=$4::jsonb, page_config=$5::jsonb,
         seo=COALESCE($6::jsonb, seo), version=version+1, updated_at=NOW()
     WHERE platform_id=$1 AND page_slug=$2 RETURNING page_slug`,
    [
      id,
      slug,
      title,
      JSON.stringify(body.page.componentTree),
      JSON.stringify(pageConfig),
      body.page.seo === undefined ? null : JSON.stringify(body.page.seo),
    ],
  );
  if (!result.rowCount)
    return NextResponse.json(
      { error: "ไม่พบ Page ที่เลือกใน platform_pages" },
      { status: 404 },
    );
  await getCoreDb().query(
    `UPDATE public.platforms SET content_updated_at=NOW(), runtime_status=CASE WHEN runtime_built_at IS NULL THEN 'not_created' ELSE 'stale' END WHERE id=$1`,
    [id],
  );
  return NextResponse.json({ ok: true, pageId: slug });
}
