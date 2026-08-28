import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { getCurrentUser } from '@/lib/auth/authActions';

export default async function ProcessStudioLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=%2Fprocess-studio');
  return <AdminShell user={user}>{children}</AdminShell>;
}
