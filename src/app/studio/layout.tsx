import React from 'react';
import { getCurrentUser } from '@/lib/auth/authActions';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { StudioUserProvider } from '@/components/studio/StudioUserContext';
import { redirect } from 'next/navigation';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  return (
    <div className="d-flex min-vh-100 bg-light" style={{ color: '#0f172a' }}>
      <AdminSidebar user={currentUser} />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <main className="flex-grow-1 p-3 overflow-y-auto" style={{ background: '#f8fafc' }}>
          <StudioUserProvider user={currentUser}>{children}</StudioUserProvider>
        </main>
      </div>
    </div>
  );
}
