import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import AdminShell from '@/components/admin/AdminShell';

export default async function FlowStudioLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login?redirect=%2Fflow-studio');
  }

  return (
    <AdminShell user={currentUser} mainClassName="p-2 p-md-3">
      {children}
    </AdminShell>
  );
}
