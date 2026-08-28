'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Palette, KeyRound } from 'lucide-react';
import { navItemFor } from '@/lib/admin/navigation';
import { UserProfile } from '@/types';

interface AdminTopbarProps {
  readonly user: UserProfile;
  readonly onOpenMenu: () => void;
}

export default function AdminTopbar({ user, onOpenMenu }: AdminTopbarProps) {
  const pathname = usePathname();
  const current = navItemFor(pathname);

  return (
    <header className="adm-topbar d-flex align-items-center justify-content-between gap-3 px-3 px-md-4">
      <div className="d-flex align-items-center gap-2 gap-md-3 min-w-0">
        <button
          type="button"
          className="btn btn-link p-2 d-lg-none text-decoration-none"
          style={{ color: 'var(--gov-ink)' }}
          onClick={onOpenMenu}
          aria-label="เปิดเมนู"
          aria-controls="admin-sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="adm-page-title text-truncate">{current?.label ?? 'ภาพรวม'}</h1>
          {current?.description && (
            <p className="adm-page-sub d-none d-sm-block text-truncate">{current.description}</p>
          )}
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 gap-md-3 flex-shrink-0">
        <Link href="/page-designer/public-home" className="adm-topbar-btn d-none d-md-inline-flex">
          <Palette size={15} aria-hidden="true" />
          <span>ออกแบบหน้าเว็บ</span>
        </Link>

        <Link
          href="/account/password"
          className="adm-topbar-btn"
          title="เปลี่ยนรหัสผ่าน"
          aria-label="เปลี่ยนรหัสผ่าน"
        >
          <KeyRound size={15} aria-hidden="true" />
          <span className="d-none d-lg-inline">เปลี่ยนรหัสผ่าน</span>
        </Link>

        <span className="d-flex align-items-center gap-2">
          <span className="adm-avatar" aria-hidden="true">
            {(user.username ?? user.email)[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="d-none d-md-block lh-sm">
            <span className="d-block" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {user.fullName || user.username}
            </span>
            <span className="d-block" style={{ fontSize: '0.72rem', color: 'var(--gov-muted)' }}>
              {user.globalRole === 'GOD' ? 'ผู้ดูแลระบบส่วนกลาง' : 'ผู้ใช้ของหน่วยงาน'}
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}
