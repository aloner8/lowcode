import React from 'react';
import { Logo } from '@/components/brand/Logo';

/**
 * Shell for the sign-in screens.
 *
 * The control plane is an official tool, so the palette follows the project's
 * government design tokens — deep blue with a gold hairline — rather than the
 * generic purple gradient it used before. The decorative panel is hidden below
 * `lg`, where the form should own the whole viewport.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell min-vh-100 d-flex">
      {/* Brand panel — decorative, so it is skipped by assistive technology. */}
      <aside className="auth-brand d-none d-lg-flex flex-column justify-content-between p-5" aria-hidden="true">
        <div>
          <Logo size={52} markOnly className="mb-4" />
          <p className="auth-brand-eyebrow mb-1">MATCHANU · Low-Code Platform</p>
          <h2 className="auth-brand-title">ระบบจัดการเว็บไซต์หน่วยงาน</h2>
          <p className="auth-brand-lead">
            ออกแบบหน้าเว็บ จัดการข่าวสาร และดูแลหลายเว็บไซต์ได้จากศูนย์กลางเดียว
          </p>
        </div>

        <ul className="auth-points list-unstyled mb-0">
          <li>
            <span className="auth-point-title">หลายเว็บไซต์ หลายโดเมน</span>
            แต่ละหน่วยงานมีเว็บ ธีม และฐานข้อมูลของตัวเอง
          </li>
          <li>
            <span className="auth-point-title">แก้ไขเนื้อหาได้เอง</span>
            เพิ่มข่าว ปรับหน้าเว็บ โดยไม่ต้องเขียนโค้ด
          </li>
          <li>
            <span className="auth-point-title">พร้อมสำหรับการค้นหา</span>
            หน้าเว็บถูกสร้างฝั่งเซิร์ฟเวอร์ พร้อม sitemap และ metadata ครบ
          </li>
        </ul>

        <p className="auth-brand-footer mb-0">
          ให้บริการโดย บริษัท หนุมานไอที จำกัด
        </p>
      </aside>

      {/* Form column */}
      <div className="auth-panel flex-grow-1 d-flex align-items-center justify-content-center p-3 p-sm-4">
        <div className="w-100" style={{ maxWidth: '27rem' }}>{children}</div>
      </div>
    </main>
  );
}
