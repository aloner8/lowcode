'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, ExternalLink, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ADMIN_NAV, ADMIN_TOOLS, visibleNav } from '@/lib/admin/navigation';
import { UserProfile } from '@/types';

interface AdminSidebarProps {
  readonly user: UserProfile;
  /** Drawer state on small screens; ignored from `lg` up. */
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly isCollapsed: boolean;
  readonly onToggleCollapse: () => void;
}

const roleLabel = (role: UserProfile['globalRole']) =>
  role === 'GOD' ? 'ผู้ดูแลระบบส่วนกลาง' : 'ผู้ใช้ของหน่วยงาน';

export default function AdminSidebar({
  user,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navItems = visibleNav(ADMIN_NAV, user.globalRole);
  const toolItems = visibleNav(ADMIN_TOOLS, user.globalRole);
  const isGod = user.globalRole === 'GOD';

  const isCurrent = (href: string) => {
    const [hrefPath, query = ''] = href.split('?');
    if (query) {
      const expected = new URLSearchParams(query);
      return pathname === hrefPath && Array.from(expected.entries()).every(([key, value]) => searchParams.get(key) === value);
    }
    return hrefPath === '/admin' ? pathname === '/admin' : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  };

  const renderLink = (item: (typeof ADMIN_NAV)[number]) => {
    const Icon = item.icon;
    const active = isCurrent(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`adm-nav-link ${active ? 'is-active' : ''}`}
          aria-current={active ? 'page' : undefined}
          title={isCollapsed ? item.label : undefined}
          onClick={onClose}
        >
          <Icon size={18} aria-hidden="true" />
          {!isCollapsed && (
            <>
              <span>{item.label}</span>
              {item.tag && <span className="adm-nav-tag">{item.tag}</span>}
              {item.external && (
                <ExternalLink
                  size={13}
                  className={item.tag ? '' : 'ms-auto'}
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </Link>
      </li>
    );
  };

  const renderTool = (item: (typeof ADMIN_TOOLS)[number]) => {
    const Icon = item.icon;
    const children = item.children ?? [];
    const childActive = children.some((child) => isCurrent(child.href));
    const active = isCurrent(item.href) || childActive;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`adm-nav-link ${active ? 'is-active' : ''}`}
          aria-current={pathname === item.href ? 'page' : undefined}
          title={isCollapsed ? item.label : undefined}
          onClick={onClose}
        >
          <Icon size={18} aria-hidden="true" />
          {!isCollapsed && <><span>{item.label}</span>{children.length > 0 && <ChevronDown size={13} className="ms-auto" />}</>}
        </Link>
        {!isCollapsed && children.length > 0 && active && (
          <ul className="adm-nav ms-3 mt-1 border-start border-light border-opacity-25 ps-2">
            {children.map((child) => {
              const ChildIcon = child.icon;
              const current = isCurrent(child.href);
              return (
                <li key={child.href}>
                  <Link href={child.href} className={`adm-nav-link ${current ? 'is-active' : ''}`} onClick={onClose}>
                    <ChildIcon size={14} aria-hidden="true" />
                    <span>{child.label}</span>
                    {child.external && <ExternalLink size={11} className="ms-auto" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {/* Dismisses the drawer on small screens; absent from the layout otherwise. */}
      {isOpen && (
        <button
          type="button"
          className="adm-backdrop d-lg-none"
          aria-label="ปิดเมนู"
          onClick={onClose}
        />
      )}

      <aside
        id="admin-sidebar"
        className={`adm-sidebar d-flex flex-column justify-content-between p-2 ${
          isCollapsed ? 'is-collapsed' : ''
        } ${isOpen ? 'is-open' : ''}`}
      >
        <div className="overflow-hidden">
          <div className="d-flex align-items-center justify-content-between gap-2 px-1 py-2 mb-2">
            <Link
              href="/admin"
              className="d-flex align-items-center gap-2 text-decoration-none text-white overflow-hidden"
              onClick={onClose}
            >
              <Logo size={34} markOnly />
              {!isCollapsed && (
                <span className="text-nowrap">
                  <span className="adm-brand-name d-block">MATCHANU</span>
                  <span className="adm-brand-sub">ระบบจัดการเว็บไซต์</span>
                </span>
              )}
            </Link>

            <button
              type="button"
              className="adm-icon-btn d-none d-lg-grid"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-controls="admin-sidebar"
              aria-label={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
            >
              {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>

            <button
              type="button"
              className="adm-icon-btn d-lg-none"
              onClick={onClose}
              aria-label="ปิดเมนู"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className={`adm-user-card mb-3 ${isCollapsed ? 'p-1' : 'p-2'}`}
            title={isCollapsed ? `${user.fullName || user.username} — ${roleLabel(user.globalRole)}` : undefined}
          >
            <div className={`d-flex align-items-center gap-2 ${isCollapsed ? 'justify-content-center' : ''}`}>
              <span className="adm-avatar" aria-hidden="true">
                {(user.username ?? user.email)[0]?.toUpperCase() ?? 'U'}
              </span>
              {!isCollapsed && (
                <span className="overflow-hidden">
                  <span className="adm-user-name d-block text-truncate">
                    {user.fullName || user.username}
                  </span>
                  <span className="adm-user-mail d-block text-truncate">{user.email}</span>
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="mt-2">
                <span className={`adm-role ${isGod ? 'is-god' : ''}`}>{roleLabel(user.globalRole)}</span>
              </div>
            )}
          </div>

          {!isCollapsed && <p className="adm-section-label mb-1">จัดการระบบ</p>}
          <ul className="adm-nav mb-3">{navItems.map(renderLink)}</ul>

          {toolItems.length > 0 && (
            <>
              {!isCollapsed && <p className="adm-section-label mb-1">เครื่องมือออกแบบ</p>}
              <ul className="adm-nav">{toolItems.map(renderTool)}</ul>
            </>
          )}
        </div>

        <div className="pt-2">
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="adm-signout" title={isCollapsed ? 'ออกจากระบบ' : undefined}>
              <LogOut size={15} aria-hidden="true" />
              {!isCollapsed && <span>ออกจากระบบ</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
