import { NextResponse } from 'next/server';
import { requireGod } from '@/lib/auth/apiAuth';
import { getCoreDb } from '@/lib/db/coreDb';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

const quotaValue = (form: FormData, key: string): number | null => {
  const raw = form.get(key)?.toString().trim() ?? '';
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 100_000 ? value : null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const form = await request.formData();
  const maxTemplates = quotaValue(form, 'maxTemplates');
  const maxApps = quotaValue(form, 'maxApps');
  const maxRunningApps = quotaValue(form, 'maxRunningApps');
  if (maxTemplates === null || maxApps === null || maxRunningApps === null) {
    return NextResponse.json({ error: 'โควต้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100000' }, { status: 400 });
  }

  try {
    const result = await getCoreDb().query<{ quotas: Record<string, number> }>(
      'SELECT public.set_customer_quotas($1, $2, $3, $4) AS quotas',
      [id, maxTemplates, maxApps, maxRunningApps],
    );
    const quotas = result.rows[0]?.quotas;
    if (!quotas) return NextResponse.json({ error: 'ไม่พบ Customer' }, { status: 404 });
    await recordPlatformAudit({
      action: 'UPDATE_CUSTOMER_QUOTAS',
      entityType: 'CUSTOMER',
      entityId: id,
      performedBy: auth.actor,
      changesSummary: `กำหนดโควต้า Template ${maxTemplates}, App ${maxApps}, Running ${maxRunningApps}`,
      snapshotAfter: quotas,
    });
    return new NextResponse(null, { status: 303, headers: { Location: `/admin/customers/${id}` } });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === 'P0001') {
      return NextResponse.json({ error: dbError.message ?? 'โควต้าต่ำกว่าการใช้งานปัจจุบัน' }, { status: 409 });
    }
    if (dbError.code === '22023') {
      return NextResponse.json({ error: dbError.message ?? 'โควต้าไม่ถูกต้อง' }, { status: 400 });
    }
    if (dbError.code === 'P0002') return NextResponse.json({ error: 'ไม่พบ Customer' }, { status: 404 });
    console.error('Unable to update Customer quotas', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกโควต้าได้' }, { status: 500 });
  }
}
