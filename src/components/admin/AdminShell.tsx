'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import { UserProfile } from '@/types';
import type { ImpersonationContext } from '@/lib/auth/authActions';

const COLLAPSE_KEY = 'matchanu:admin-sidebar-collapsed';

/**
 * Chrome around every admin screen.
 *
 * The drawer and collapse state live here rather than in the layout so the
 * layout can stay a Server Component and keep fetching the session on the
 * server. The collapsed preference is remembered per browser — operators work
 * in this console all day and re-collapsing on every navigation is friction.
 */
export default function AdminShell({
  user,
  children,
  /** Studio canvases want the whole viewport, so they turn the padding down. */
  mainClassName = 'p-3 p-md-4',
  impersonation = null,
}: {
  readonly user: UserProfile;
  readonly children: React.ReactNode;
  readonly mainClassName?: string;
  readonly impersonation?: ImpersonationContext | null;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === '/admin';
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // Private browsing can refuse storage; the default is fine.
    }
  }, []);

  // Navigating on a phone should reveal the destination, not the menu.
  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const toggleCollapse = () => {
    setIsCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // Remembering is a convenience, not a requirement.
      }
      return next;
    });
  };

  return (
    <div className="adm-shell d-flex min-vh-100">
      {!isDashboard && (
        <AdminSidebar
          user={user}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      )}

      <div className="d-flex flex-column flex-grow-1 min-w-0">
        <AdminTopbar user={user} onOpenMenu={() => setIsOpen(true)} showMenuButton={!isDashboard} />
        {impersonation && (
          <div className="alert alert-warning rounded-0 border-start-0 border-end-0 mb-0 d-flex align-items-center justify-content-between gap-3 px-3 px-md-4 py-2" role="status">
            <span>
              กำลังสวมสิทธิ์เป็น <strong>{user.fullName || user.username}</strong>
              <span className="d-none d-md-inline"> · เริ่มโดย {impersonation.originalFullName}</span>
            </span>
            <form action="/api/admin/impersonation/stop" method="post">
              <button type="submit" className="btn btn-sm btn-outline-dark">กลับบัญชี Admin</button>
            </form>
          </div>
        )}
        <main className={`flex-grow-1 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}
