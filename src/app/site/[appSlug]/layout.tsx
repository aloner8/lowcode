import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/authActions';
import { logoutAction } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { Logo } from '@/components/brand/Logo';
import SiteConsoleNav, { type SiteNavItem } from '@/components/site/SiteConsoleNav';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  GOD: 'ผู้ดูแลระบบส่วนกลาง',
  ADMIN: 'ผู้ดูแลเว็บไซต์',
  STAFF: 'เจ้าหน้าที่',
  VIEWER: 'ดูอย่างเดียว',
};

/**
 * Console for one agency's site.
 *
 * ADMIN (ผู้ดูแลระบบของหน่วยงาน) and STAFF (พนักงาน) work here; the provider's
 * control plane at /admin stays out of reach.
 */
export default async function SiteConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ appSlug: string }>;
}) {
  const { appSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/site/${appSlug}`);

  const result = await getCoreDb().query<{ id: string; app_name: string; role: string | null }>(
    `SELECT a.id, a.app_name, public.site_role_of($2, a.id) AS role
     FROM public.apps a WHERE a.app_slug = $1 AND a.is_active`,
    [appSlug, user.id],
  );
  if (!result.rowCount) notFound();

  const site = result.rows[0];
  if (!site.role) notFound();

  const isAdmin = site.role === 'ADMIN' || site.role === 'GOD';

  const navigation: SiteNavItem[] = [
    { href: `/site/${appSlug}`, label: 'ภาพรวม', icon: 'overview' },
    ...(isAdmin
      ? [{ href: `/site/${appSlug}/users`, label: 'ผู้ใช้ในหน่วยงาน', icon: 'users' as const }]
      : []),
  ];

  return (
    <div className="adm-shell min-vh-100">
      <header className="adm-site-header">
        <div className="px-3 px-md-4 pt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 min-w-0">
            <Logo size={34} markOnly />
            <div className="min-w-0">
              <h1 className="adm-site-name text-truncate">{site.app_name}</h1>
              <p className="adm-site-meta text-truncate">
                {user.fullName || user.username} · {ROLE_LABELS[site.role] ?? site.role}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Link
              href={`/app/${appSlug}`}
              className="adm-topbar-btn"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} aria-hidden="true" /> เปิดเว็บไซต์
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="adm-btn is-quiet is-sm">
                <LogOut size={14} aria-hidden="true" />
                <span className="d-none d-sm-inline">ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </div>

        <div className="px-3 px-md-4">
          <SiteConsoleNav items={navigation} />
        </div>
      </header>

      <main className="p-3 p-md-4">{children}</main>
    </div>
  );
}
