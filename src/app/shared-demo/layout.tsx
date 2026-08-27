import React from 'react';
import { redirect } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/authActions';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Component gallery for developers.
 *
 * Rendered without any shell before, so following a link here stranded the
 * operator on a bare page. The notice matters as much as the chrome: every
 * figure below is invented sample data, and the page gave no sign of that.
 */
export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login?redirect=%2Fshared-demo');
  }

  return (
    <AdminShell user={currentUser}>
      <div className="adm-alert is-warn mb-3">
        <FlaskConical size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
        <span>
          <strong>หน้าตัวอย่างสำหรับนักพัฒนา</strong>
          <span className="d-block">
            ข้อมูลทั้งหมดในหน้านี้เป็นข้อมูลสมมติสำหรับทดสอบการแสดงผล ไม่ใช่ข้อมูลจริงของหน่วยงานใด
          </span>
        </span>
      </div>
      {children}
    </AdminShell>
  );
}
