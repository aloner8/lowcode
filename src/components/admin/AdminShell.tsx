'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import { UserProfile } from '@/types';

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
}: {
  readonly user: UserProfile;
  readonly children: React.ReactNode;
  readonly mainClassName?: string;
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
        <main className={`flex-grow-1 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}
