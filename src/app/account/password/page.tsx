import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'เปลี่ยนรหัสผ่าน',
  robots: { index: false, follow: false },
};

/**
 * Change-password screen.
 *
 * Accounts still carrying a seeded password are redirected here by the
 * middleware and cannot reach anything else until they set their own.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/account/password');

  return (
    <main className="auth-shell min-vh-100 d-flex align-items-center justify-content-center p-3 p-sm-4">
      <div className="w-100" style={{ maxWidth: '28rem' }}>
        <ChangePasswordForm
          fullName={user.fullName || user.username || user.email}
          required={user.mustChangePassword ?? false}
        />
      </div>
    </main>
  );
}
