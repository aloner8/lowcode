import { NextResponse } from 'next/server';
import { requireApiSession, requireSiteAccess } from '@/lib/auth/apiAuth';
import { loadAppRuntimeState, registerAppRuntimeOperation, type AppDesiredState } from '@/lib/runtime/appRuntimeState';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(appId: string, role: 'VIEWER' | 'ADMIN') {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return { response: auth };
  const denied = await requireSiteAccess(auth, appId, role);
  return denied ? { response: denied } : { auth };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await authorize(id, 'VIEWER');
  if (guard.response) return guard.response;
  const state = await loadAppRuntimeState(id);
  return state
    ? NextResponse.json({ runtime: state })
    : NextResponse.json({ error: 'ไม่พบ App' }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await authorize(id, 'ADMIN');
  if (guard.response) return guard.response;
  const operationKey = request.headers.get('Idempotency-Key')?.trim() ?? '';
  const body = await request.json().catch(() => null) as { desiredState?: unknown } | null;
  const desiredState = body?.desiredState as AppDesiredState | undefined;
  if (!operationKey || operationKey.length > 180) {
    return NextResponse.json({ error: 'ต้องส่ง Idempotency-Key' }, { status: 400 });
  }
  if (desiredState !== 'RUNNING' && desiredState !== 'STOPPED') {
    return NextResponse.json({ error: 'desiredState ต้องเป็น RUNNING หรือ STOPPED' }, { status: 400 });
  }

  try {
    const registration = await registerAppRuntimeOperation({
      actorId: guard.auth!.sub, appId: id, desiredState, operationKey,
    });
    if (!registration.reused) {
      await recordPlatformAudit({
        entityType: 'RUNTIME', entityId: id,
        action: desiredState === 'RUNNING' ? 'START_APP' : 'STOP_APP',
        performedBy: guard.auth!.actor,
        changesSummary: `ร้องขอ ${desiredState === 'RUNNING' ? 'Start' : 'Stop'} App`,
        snapshotAfter: { desiredState, operationId: registration.operationId },
      });
    }
    return NextResponse.json({
      operationId: registration.operationId,
      reused: registration.reused,
      runtime: await loadAppRuntimeState(id),
    }, { status: registration.reused ? 200 : 202 });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === '42501') return NextResponse.json({ error: 'ไม่มีสิทธิ์ควบคุม App นี้' }, { status: 403 });
    if (dbError.code === 'P0001') return NextResponse.json({ error: dbError.message ?? 'เกินโควต้า App ที่รันพร้อมกัน' }, { status: 409 });
    if (['22023', 'P0002'].includes(dbError.code ?? '')) return NextResponse.json({ error: dbError.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    console.error('Unable to register App runtime operation', error);
    return NextResponse.json({ error: 'ไม่สามารถสั่งงาน App ได้' }, { status: 500 });
  }
}
