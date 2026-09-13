import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getCurrentUser, getImpersonationContext } from '@/lib/auth/authActions';
import { findCustomerAccessBlock } from '@/lib/auth/customerAccess';

export const dynamic = 'force-dynamic';

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [blocked, impersonation] = await Promise.all([
    findCustomerAccessBlock(user.id, user.globalRole),
    getImpersonationContext(),
  ]);
  if (!blocked) redirect('/admin');

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <section className="adm-card p-4 text-center" style={{ maxWidth: 560 }}>
        <ShieldAlert size={42} className="text-warning mb-3" aria-hidden="true" />
        <h1 className="h4">บัญชี Customer ถูกระงับ</h1>
        <p className="text-secondary mb-2">
          สิทธิ์เข้าเว็บแม่ของ <strong>{blocked.customerName}</strong> ถูกระงับชั่วคราว
        </p>
        <p className="small text-secondary">
          เว็บไซต์และข้อมูลของหน่วยงานยังคงอยู่ตามเดิม กรุณาติดต่อผู้ให้บริการหากต้องการเปิดสิทธิ์อีกครั้ง
        </p>
        {impersonation ? (
          <form action="/api/admin/impersonation/stop" method="post">
            <button type="submit" className="btn btn-primary">กลับบัญชี Admin</button>
          </form>
        ) : (
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn-outline-secondary">ออกจากระบบ</button>
          </form>
        )}
      </section>
    </main>
  );
}
