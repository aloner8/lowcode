import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TemplateRow = {
  id: string; template_name: string; parameter_schema: string[]; object_graph: unknown[];
  is_public: boolean; owner_user_id: string; owner_name: string; updated_at: Date;
};

const mapTemplate = (row: TemplateRow, userId: string) => ({
  id: row.id,
  name: row.template_name,
  parameters: row.parameter_schema,
  objects: row.object_graph,
  isPublic: row.is_public,
  isOwner: row.owner_user_id === userId,
  ownerName: row.owner_name,
  updatedAt: row.updated_at.toISOString(),
});

function renderGraph(value: unknown, parameters: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (token, key: string) =>
      Object.prototype.hasOwnProperty.call(parameters, key) ? String(parameters[key] ?? '') : token,
    );
  }
  if (Array.isArray(value)) return value.map((item) => renderGraph(item, parameters));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderGraph(item, parameters)]));
  }
  return value;
}

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const templates = await getCoreDb().query<TemplateRow>(
      `SELECT t.id, t.template_name, t.parameter_schema, t.object_graph, t.is_public,
              t.owner_user_id, COALESCE(u.full_name, u.username) AS owner_name, t.updated_at
       FROM public.design_module_templates t
       JOIN public.platform_users u ON u.id = t.owner_user_id
       WHERE t.owner_user_id = $1 OR t.is_public = TRUE
       ORDER BY (t.owner_user_id = $1) DESC, t.updated_at DESC`,
      [auth.sub],
    );

    const platformId = new URL(request.url).searchParams.get('platformId');
    if (!platformId) return NextResponse.json({ templates: templates.rows.map((row) => mapTemplate(row, auth.sub)), modules: [] });
    const denied = await requirePlatformAccess(auth, platformId);
    if (denied) return denied;
    const modules = await getCoreDb().query(
      `SELECT m.id, m.module_name AS name, m.template_id AS "templateId",
              m.parameter_values AS parameters, m.object_graph AS objects,
              m.created_by_user_id AS "createdByUserId", m.updated_at AS "updatedAt"
       FROM public.platform_design_modules m WHERE m.platform_id = $1 ORDER BY m.updated_at DESC`,
      [platformId],
    );
    return NextResponse.json({ templates: templates.rows.map((row) => mapTemplate(row, auth.sub)), modules: modules.rows });
  } catch (error) {
    console.error('Unable to load module templates', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแม่แบบ Module ได้ กรุณาตรวจสอบว่า migration 019 ทำงานแล้ว' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.kind === 'template') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const parameters = Array.isArray(body.parameters) && body.parameters.every((item) => typeof item === 'string') ? body.parameters : null;
      const objects = Array.isArray(body.objects) ? body.objects : null;
      if (!name || name.length > 255 || !parameters || !objects) {
        return NextResponse.json({ error: 'ชื่อ, parameters หรือ Object Graph ไม่ถูกต้อง' }, { status: 400 });
      }
      const result = await getCoreDb().query<TemplateRow>(
        `INSERT INTO public.design_module_templates
           (owner_user_id, template_name, parameter_schema, object_graph, is_public)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
         RETURNING id, template_name, parameter_schema, object_graph, is_public,
                   owner_user_id, $6::text AS owner_name, updated_at`,
        [auth.sub, name, JSON.stringify(parameters), JSON.stringify(objects), Boolean(body.isPublic), auth.actor],
      );
      return NextResponse.json({ template: mapTemplate(result.rows[0], auth.sub) }, { status: 201 });
    }

    if (body.kind === 'module') {
      const platformId = typeof body.platformId === 'string' ? body.platformId : '';
      const templateId = typeof body.templateId === 'string' ? body.templateId : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const parameters = body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters)
        ? body.parameters as Record<string, unknown> : null;
      if (!platformId || !templateId || !name || name.length > 255 || !parameters) {
        return NextResponse.json({ error: 'ข้อมูล Module ไม่ครบหรือไม่ถูกต้อง' }, { status: 400 });
      }
      const denied = await requirePlatformAccess(auth, platformId, 'STAFF');
      if (denied) return denied;
      const template = await getCoreDb().query<TemplateRow>(
        `SELECT t.*, COALESCE(u.full_name, u.username) AS owner_name
         FROM public.design_module_templates t JOIN public.platform_users u ON u.id=t.owner_user_id
         WHERE t.id=$1 AND (t.owner_user_id=$2 OR t.is_public=TRUE)`,
        [templateId, auth.sub],
      );
      if (!template.rowCount) return NextResponse.json({ error: 'ไม่พบแม่แบบหรือไม่มีสิทธิ์ใช้งาน' }, { status: 404 });
      const rendered = renderGraph(template.rows[0].object_graph, parameters);
      const result = await getCoreDb().query(
        `INSERT INTO public.platform_design_modules
           (platform_id, template_id, created_by_user_id, module_name, parameter_values, object_graph)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
         RETURNING id, module_name AS name, template_id AS "templateId", parameter_values AS parameters, object_graph AS objects`,
        [platformId, templateId, auth.sub, name, JSON.stringify(parameters), JSON.stringify(rendered)],
      );
      return NextResponse.json({ module: result.rows[0] }, { status: 201 });
    }
    return NextResponse.json({ error: 'kind ต้องเป็น template หรือ module' }, { status: 400 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') return NextResponse.json({ error: 'ชื่อนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น' }, { status: 409 });
    console.error('Unable to save module template', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูล Module ได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || typeof body.isPublic !== 'boolean') return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const result = await getCoreDb().query(
    `UPDATE public.design_module_templates SET is_public=$3
     WHERE id=$1 AND owner_user_id=$2 RETURNING id, is_public AS "isPublic"`,
    [id, auth.sub, body.isPublic],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'แก้ไขได้เฉพาะแม่แบบของตนเอง' }, { status: 403 });
  return NextResponse.json({ template: result.rows[0] });
}
