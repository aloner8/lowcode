import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { LayoutDashboard, Users, ExternalLink, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Console for one agency's Site.
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

  const navigation = [
    { href: `/site/${appSlug}`, label: 'ภาพรวม', icon: LayoutDashboard, show: true },
    { href: `/site/${appSlug}/users`, label: 'ผู้ใช้ในหน่วยงาน', icon: Users, show: isAdmin },
  ].filter((item) => item.show);

  return (
    <div className="min-vh-100 bg-light">
      <header className="bg-white border-bottom">
        <div className="container-fluid px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <Building2 size={22} className="text-primary" />
            <div>
              <h1 className="h6 fw-bold mb-0 text-dark">{site.app_name}</h1>
              <p className="extra-small text-secondary mb-0">
                {user.fullName || user.username} · สิทธิ์ {site.role}
              </p>
            </div>
          </div>
          <Link href={`/app/${appSlug}`} className="btn btn-sm btn-outline-primary" target="_blank">
            <ExternalLink size={14} className="me-1" /> เปิดเว็บไซต์
          </Link>
        </div>

        <nav className="container-fluid px-4" aria-label="เมนูหน่วยงาน">
          <ul className="nav nav-tabs border-0">
            {navigation.map((item) => (
              <li className="nav-item" key={item.href}>
                <Link className="nav-link d-flex align-items-center gap-1 small" href={item.href}>
                  <item.icon size={14} /> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="container-fluid px-4 py-4">{children}</div>
    </div>
  );
}
