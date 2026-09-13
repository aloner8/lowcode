import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, getImpersonationContext } from '@/lib/auth/authActions';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [currentUser, impersonation] = await Promise.all([
    getCurrentUser(),
    getImpersonationContext(),
  ]);

  if (!currentUser) {
    redirect('/login?redirect=%2Fadmin');
  }

  return <AdminShell user={currentUser} impersonation={impersonation}>{children}</AdminShell>;
}
