import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { getCurrentUser } from '@/lib/auth/authActions';

export default async function PageDesignerLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=%2Fpage-designer');
  return <AdminShell user={user} mainClassName="p-0">{children}</AdminShell>;
}
