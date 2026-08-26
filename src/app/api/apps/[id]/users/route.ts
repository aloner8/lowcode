import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireSiteSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import type { SiteRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_ROLES: SiteRole[] = ['ADMIN', 'STAFF', 'VIEWER'];

const SELECT_MEMBERS = `
  SELECT u.id, u.username, u.email, u.full_name AS "fullName",
         u.is_active AS "isActive", u.must_change_password AS "mustChangePassword",
         u.last_login_at AS "lastLoginAt", m.app_role AS "siteRole", m.created_at AS "grantedAt"
  FROM public.app_memberships m
  JOIN public.platform_users u ON u.id = m.user_id
  WHERE m.app_id = $1
  ORDER BY CASE m.app_role WHEN 'ADMIN' THEN 0 WHEN 'STAFF' THEN 1 ELSE 2 END, u.username
`;

/** ผู้ดูแลระบบของหน่วยงานเห็นเฉพาะผู้ใช้ของ Site ตัวเอง */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireSiteSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const result = await getCoreDb().query(SELECT_MEMBERS, [id]);
  return NextResponse.json({ users: result.rows });
}

/**
 * Adds a user to this Site.
 *
 * An existing account is granted membership; a new email creates the account
 * first. The seat limit from the Site's package is enforced here.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireSiteSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const siteRole = typeof body.siteRole === 'string' ? body.siteRole : 'STAFF';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' }, { status: 400 });
    }
    if (!SITE_ROLES.includes(siteRole as SiteRole)) {
      return NextResponse.json({ error: `สิทธิ์ต้องเป็น ${SITE_ROLES.join(' | ')}` }, { status: 400 });
    }

    // Seat limit from the site's package.
    const limits = await getCoreDb().query<{ max_users: number | null; seats: string }>(
      `SELECT (a.package_limits ->> 'maxUsers')::int AS max_users,
              (SELECT COUNT(*)::text FROM public.app_memberships m WHERE m.app_id = a.id) AS seats
       FROM public.apps a WHERE a.id = $1`,
      [id],
    );
    if (!limits.rowCount) return NextResponse.json({ error: 'ไม่พบ Site' }, { status: 404 });
    const maxUsers = limits.rows[0].max_users;
    if (maxUsers && Number(limits.rows[0].seats) >= maxUsers) {
      return NextResponse.json(
        { error: `แพ็กเกจนี้รองรับผู้ใช้ได้สูงสุด ${maxUsers} คน` },
        { status: 409 },
      );
    }

    const client = await getCoreDb().connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query<{ id: string; global_role: string }>(
        'SELECT id, global_role FROM public.platform_users WHERE LOWER(email) = $1',
        [email],
      );

      let userId: string;
      if (existing.rowCount) {
        userId = existing.rows[0].id;
      } else {
        if (password.length < 8) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { error: 'ผู้ใช้ใหม่ต้องกำหนดรหัสผ่านอย่างน้อย 8 ตัวอักษร' },
            { status: 400 },
          );
        }
        // Usernames are globally unique, but the local-part of an email often
        // is not ("admin@a.go.th" and "admin@b.go.th"), so a free variant is
        // resolved before inserting.
        const desired = (username || email.split('@')[0]).toLowerCase();
        const unique = await client.query<{ username: string }>(
          `WITH RECURSIVE candidate(name, n) AS (
             SELECT $1::text, 0
             UNION ALL
             SELECT $1 || (n + 1)::text, n + 1 FROM candidate WHERE n < 50
           )
           SELECT c.name AS username FROM candidate c
           WHERE NOT EXISTS (
             SELECT 1 FROM public.platform_users u
             WHERE LOWER(BTRIM(u.username)) = c.name
           )
           ORDER BY c.n LIMIT 1`,
          [desired],
        );
        const finalUsername = unique.rows[0]?.username ?? `${desired}_${Date.now().toString(36)}`;

        const created = await client.query<{ id: string }>(
          `INSERT INTO public.platform_users
             (username, email, full_name, password_hash, global_role, must_change_password)
           VALUES ($1, $2, $3, crypt($4, gen_salt('bf', 12)), 'TENANT_USER', TRUE)
           RETURNING id`,
          [finalUsername, email, fullName || finalUsername, password],
        );
        userId = created.rows[0].id;
      }

      await client.query(
        `INSERT INTO public.app_memberships (user_id, app_id, app_role, granted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, app_id) DO UPDATE SET app_role = excluded.app_role`,
        [userId, id, siteRole, auth.sub],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await recordPlatformAudit({
      entityType: 'USER',
      entityId: id,
      action: 'CREATE_USER',
      performedBy: auth.actor,
      changesSummary: `เพิ่มผู้ใช้ ${email} เข้า Site (${siteRole})`,
    });

    const result = await getCoreDb().query(SELECT_MEMBERS, [id]);
    return NextResponse.json({ users: result.rows }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Username หรือ Email นี้ถูกใช้ไปแล้ว' }, { status: 409 });
    }
    console.error('Unable to add site user', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มผู้ใช้ได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireSiteSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { userId?: string; siteRole?: string };
    if (!body.userId || !SITE_ROLES.includes(body.siteRole as SiteRole)) {
      return NextResponse.json({ error: 'ต้องระบุ userId และสิทธิ์ที่ถูกต้อง' }, { status: 400 });
    }

    // A site must keep at least one ADMIN.
    if (body.siteRole !== 'ADMIN') {
      const admins = await getCoreDb().query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.app_memberships
         WHERE app_id = $1 AND app_role = 'ADMIN' AND user_id <> $2`,
        [id, body.userId],
      );
      if (Number(admins.rows[0].count) === 0) {
        return NextResponse.json({ error: 'Site ต้องมี ADMIN อย่างน้อยหนึ่งคน' }, { status: 409 });
      }
    }

    await getCoreDb().query(
      'UPDATE public.app_memberships SET app_role = $3 WHERE app_id = $1 AND user_id = $2',
      [id, body.userId, body.siteRole],
    );
    await recordPlatformAudit({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE_USER',
      performedBy: auth.actor,
      changesSummary: `ปรับสิทธิ์ผู้ใช้ใน Site เป็น ${body.siteRole}`,
    });

    const result = await getCoreDb().query(SELECT_MEMBERS, [id]);
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error('Unable to update site user', error);
    return NextResponse.json({ error: 'ไม่สามารถปรับสิทธิ์ได้' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireSiteSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'ต้องระบุ userId' }, { status: 400 });
  if (userId === auth.sub) {
    return NextResponse.json({ error: 'ไม่สามารถถอดสิทธิ์ของตนเองได้' }, { status: 409 });
  }

  const admins = await getCoreDb().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.app_memberships
     WHERE app_id = $1 AND app_role = 'ADMIN' AND user_id <> $2`,
    [id, userId],
  );
  if (Number(admins.rows[0].count) === 0) {
    return NextResponse.json({ error: 'Site ต้องมี ADMIN อย่างน้อยหนึ่งคน' }, { status: 409 });
  }

  await getCoreDb().query(
    'DELETE FROM public.app_memberships WHERE app_id = $1 AND user_id = $2',
    [id, userId],
  );
  await recordPlatformAudit({
    entityType: 'USER',
    entityId: id,
    action: 'DELETE_USER',
    performedBy: auth.actor,
    changesSummary: 'ถอดผู้ใช้ออกจาก Site',
  });
  return NextResponse.json({ deleted: true });
}
