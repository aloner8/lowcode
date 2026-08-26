import React from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import SiteUserManager from '@/components/site/SiteUserManager';

export const dynamic = 'force-dynamic';

/** ADMIN ของหน่วยงานเท่านั้นที่จัดการผู้ใช้ของ Site ตัวเองได้ */
export default async function SiteUsersPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}) {
  const { appSlug } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const result = await getCoreDb().query<{ id: string; role: string | null; max_users: number | null }>(
    `SELECT a.id, public.site_role_of($2, a.id) AS role,
            (a.package_limits ->> 'maxUsers')::int AS max_users
     FROM public.apps a WHERE a.app_slug = $1 AND a.is_active`,
    [appSlug, user.id],
  );
  if (!result.rowCount) notFound();

  const { id, role, max_users: maxUsers } = result.rows[0];
  if (role !== 'ADMIN' && role !== 'GOD') notFound();

  return <SiteUserManager appId={id} currentUserId={user.id} maxUsers={maxUsers} />;
}
