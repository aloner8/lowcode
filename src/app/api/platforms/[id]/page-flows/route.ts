import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_VIEWER');
  if (auth instanceof NextResponse) return auth;

  try {
    const routePath = new URL(request.url).searchParams.get('route');
    if (!routePath) {
      const all = await getCoreDb().query(
        `SELECT id, route_path AS "routePath", route_label AS "routeLabel", template_type AS "templateType", nodes, edges, updated_at AS "updatedAt" FROM public.platform_page_flows WHERE platform_id = $1 ORDER BY route_path`,
        [id],
      );
      return NextResponse.json({ flows: all.rows });
    }
    const result = await getCoreDb().query(
      `SELECT id, route_path AS "routePath", route_label AS "routeLabel",
              template_type AS "templateType", nodes, edges, updated_at AS "updatedAt"
       FROM public.platform_page_flows WHERE platform_id = $1 AND route_path = $2`,
      [id, routePath],
    );
    return NextResponse.json({ flow: result.rows[0] ?? null });
  } catch (error) {
    console.error('Unable to load page flow', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด Page Flow ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'APP_EDITOR', 'DEVELOPER');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const routePath = typeof body.routePath === 'string' ? body.routePath.trim() : '';
    const routeLabel = typeof body.routeLabel === 'string' ? body.routeLabel.trim() : '';
    const templateType = body.templateType;
    if (!routePath || !routeLabel || !['public_page', 'form_crud'].includes(String(templateType)) || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json({ error: 'ข้อมูล Page Flow ไม่ถูกต้อง' }, { status: 400 });
    }
    const result = await getCoreDb().query(
      `INSERT INTO public.platform_page_flows
         (platform_id, route_path, route_label, template_type, nodes, edges)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       ON CONFLICT (platform_id, route_path) DO UPDATE SET
         route_label = EXCLUDED.route_label, template_type = EXCLUDED.template_type,
         nodes = EXCLUDED.nodes, edges = EXCLUDED.edges
       RETURNING id, route_path AS "routePath", route_label AS "routeLabel",
                 template_type AS "templateType", nodes, edges, updated_at AS "updatedAt"`,
      [id, routePath, routeLabel, templateType, JSON.stringify(body.nodes), JSON.stringify(body.edges)],
    );
    await recordPlatformAudit({
      platformId: id,
      entityType: 'FLOW',
      entityId: result.rows[0].id,
      action: 'UPDATE_FLOW',
      performedBy: auth.actor,
      changesSummary: `บันทึก Page Flow '${routeLabel}' (${routePath})`,
    });
    return NextResponse.json({ flow: result.rows[0] });
  } catch (error) {
    console.error('Unable to save page flow', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Page Flow ได้' }, { status: 500 });
  }
}
