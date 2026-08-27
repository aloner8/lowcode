import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import AdminShell from '@/components/admin/AdminShell';

/**
 * The audit log is reached from the console sidebar, but rendered without any
 * shell — following the link dropped the operator onto a bare page with no way
 * back. It now sits in the same chrome as every other console screen.
 */
export default async function AuditLogsLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login?redirect=%2Faudit-logs');
  }

  return <AdminShell user={currentUser}>{children}</AdminShell>;
}
