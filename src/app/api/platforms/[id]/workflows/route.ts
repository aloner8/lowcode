import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import type { PlatformFlowType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FLOW_TYPES: PlatformFlowType[] = ['ENTERPRISE', 'SEQUENCE', 'APP_MANIFEST', 'PAGE'];

const SELECT_FLOWS = `
  SELECT id, platform_id AS "platformId", flow_code AS "flowCode", flow_name AS "flowName",
         flow_type AS "flowType", nodes, edges, config, updated_at AS "updatedAt"
  FROM public.platform_workflows
`;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const flowCode = new URL(request.url).searchParams.get('flowCode');

  try {
    if (flowCode) {
      const result = await getCoreDb().query(
        `${SELECT_FLOWS} WHERE platform_id = $1 AND flow_code = $2`,
        [id, flowCode],
      );
      return NextResponse.json({ workflow: result.rows[0] ?? null });
    }
    const result = await getCoreDb().query(`${SELECT_FLOWS} WHERE platform_id = $1 ORDER BY flow_code`, [id]);
    return NextResponse.json({ workflows: result.rows });
  } catch (error) {
    console.error('Unable to load platform workflows', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่าน Workflow ได้' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const flowCode = typeof body.flowCode === 'string' ? body.flowCode.trim() : '';
    const flowName = typeof body.flowName === 'string' ? body.flowName.trim() : '';
    const flowType = typeof body.flowType === 'string' ? body.flowType : '';

    if (!flowCode || !flowName || !FLOW_TYPES.includes(flowType as PlatformFlowType)) {
      return NextResponse.json(
        { error: `ต้องระบุ flowCode, flowName และ flowType (${FLOW_TYPES.join(' | ')})` },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json({ error: 'nodes และ edges ต้องเป็น array' }, { status: 400 });
    }

    const result = await getCoreDb().query(
      `INSERT INTO public.platform_workflows
         (platform_id, flow_code, flow_name, flow_type, nodes, edges, config)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
       ON CONFLICT (platform_id, flow_code) DO UPDATE SET
         flow_name = excluded.flow_name, flow_type = excluded.flow_type,
         nodes = excluded.nodes, edges = excluded.edges, config = excluded.config
       RETURNING id, platform_id AS "platformId", flow_code AS "flowCode", flow_name AS "flowName",
                 flow_type AS "flowType", nodes, edges, config, updated_at AS "updatedAt"`,
      [
        id, flowCode, flowName, flowType,
        JSON.stringify(body.nodes), JSON.stringify(body.edges),
        JSON.stringify(body.config ?? {}),
      ],
    );

    await recordPlatformAudit({
      platformId: id,
      entityType: 'FLOW',
      entityId: result.rows[0].id,
      action: 'UPDATE_FLOW',
      performedBy: auth.actor,
      changesSummary: `บันทึก Workflow '${flowName}' (${flowCode}, ${(body.nodes as unknown[]).length} node)`,
    });

    return NextResponse.json({ workflow: result.rows[0] });
  } catch (error) {
    console.error('Unable to save platform workflow', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Workflow ได้' }, { status: 500 });
  }
}
