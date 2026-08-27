import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import AdminShell from '@/components/admin/AdminShell';
import { StudioUserProvider } from '@/components/studio/StudioUserContext';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login?redirect=%2Fstudio');
  }

  return (
    <AdminShell user={currentUser} mainClassName="p-2 p-md-3">
      <StudioUserProvider user={currentUser}>{children}</StudioUserProvider>
    </AdminShell>
  );
}
