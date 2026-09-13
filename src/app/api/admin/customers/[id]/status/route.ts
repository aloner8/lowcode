import { NextResponse } from 'next/server';
import { requireGod } from '@/lib/auth/apiAuth';
import { getCoreDb } from '@/lib/db/coreDb';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';

type MutableCustomerStatus = 'ACTIVE' | 'SUSPENDED';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const form = await request.formData();
  const status = form.get('status')?.toString() as MutableCustomerStatus | undefined;
  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    return NextResponse.json({ error: 'สถานะต้องเป็น ACTIVE หรือ SUSPENDED' }, { status: 400 });
  }

  const result = await getCoreDb().query<{
    id: string; customer_name: string; previous_status: string; status: MutableCustomerStatus;
  }>(`
    WITH previous AS (
      SELECT id, status AS previous_status FROM public.customers WHERE id = $1
    )
    UPDATE public.customers customer
       SET status = $2
      FROM previous
     WHERE customer.id = previous.id
    RETURNING customer.id, customer.customer_name, previous.previous_status, customer.status
  `, [id, status]);
  if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Customer' }, { status: 404 });
  const customer = result.rows[0];

  await recordPlatformAudit({
    action: status === 'SUSPENDED' ? 'SUSPEND_CUSTOMER' : 'RESUME_CUSTOMER',
    entityType: 'CUSTOMER',
    entityId: customer.id,
    performedBy: auth.actor,
    changesSummary: `${status === 'SUSPENDED' ? 'ระงับ' : 'เปิด'}สิทธิ์เว็บแม่ของ ${customer.customer_name}; App และข้อมูลยังคงเดิม`,
    snapshotBefore: { status: customer.previous_status },
    snapshotAfter: { status: customer.status, appsChanged: false },
  });

  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/admin/customers/${customer.id}` },
  });
}
