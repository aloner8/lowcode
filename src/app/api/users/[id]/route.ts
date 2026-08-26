import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { PLATFORM_USER_COLUMNS, toUser } from '@/lib/auth/platformUsers';
import type { GlobalRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES: GlobalRole[] = ['SUPER_ADMIN', 'DEVELOPER', 'VIEWER'];

const SELECT_USER = `SELECT ${PLATFORM_USER_COLUMNS} FROM public.platform_users WHERE id = $1`;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('SUPER_ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [id];

    if (typeof body.fullName === 'string') {
      params.push(body.fullName.trim());
      updates.push(`full_name = $${params.length}`);
    }
    if (typeof body.email === 'string' && body.email.trim()) {
      params.push(body.email.trim().toLowerCase());
      updates.push(`email = $${params.length}`);
    }
    if (typeof body.globalRole === 'string') {
      if (!ROLES.includes(body.globalRole as GlobalRole)) {
        return NextResponse.json({ error: `Role ต้องเป็น ${ROLES.join(' | ')}` }, { status: 400 });
      }
      // Refuse to strip the last SUPER_ADMIN, which would lock everyone out.
      if (body.globalRole !== 'SUPER_ADMIN') {
        const admins = await getCoreDb().query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM public.platform_users
           WHERE global_role = 'SUPER_ADMIN' AND is_active = TRUE AND id <> $1`,
          [id],
        );
        if (Number(admins.rows[0].count) === 0) {
          return NextResponse.json({ error: 'ต้องมี SUPER_ADMIN อย่างน้อยหนึ่งคนในระบบ' }, { status: 409 });
        }
      }
      params.push(body.globalRole);
      updates.push(`global_role = $${params.length}`);
    }
    if (typeof body.isActive === 'boolean') {
      if (!body.isActive && id === auth.sub) {
        return NextResponse.json({ error: 'ไม่สามารถปิดใช้งานบัญชีของตนเองได้' }, { status: 409 });
      }
      params.push(body.isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
      }
      await getCoreDb().query('SELECT public.set_platform_user_password($1, $2)', [id, body.password]);
      await getCoreDb().query(
        'UPDATE public.platform_users SET must_change_password = TRUE WHERE id = $1',
        [id],
      );
    }

    if (updates.length) {
      await getCoreDb().query(
        `UPDATE public.platform_users SET ${updates.join(', ')} WHERE id = $1`,
        params,
      );
    }

    const result = await getCoreDb().query(SELECT_USER, [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

    const user = toUser(result.rows[0]);
    await recordPlatformAudit({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE_USER',
      performedBy: auth.actor,
      changesSummary: `แก้ไขผู้ใช้ ${user.username}`,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Email นี้ถูกใช้ไปแล้ว' }, { status: 409 });
    }
    console.error('Unable to update user', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขผู้ใช้ได้' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('SUPER_ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (id === auth.sub) {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตนเองได้' }, { status: 409 });
  }

  const existing = await getCoreDb().query(SELECT_USER, [id]);
  if (!existing.rowCount) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

  await getCoreDb().query('DELETE FROM public.platform_users WHERE id = $1', [id]);
  await recordPlatformAudit({
    entityType: 'USER',
    entityId: id,
    action: 'DELETE_USER',
    performedBy: auth.actor,
    changesSummary: `ลบผู้ใช้ ${existing.rows[0].username}`,
  });
  return NextResponse.json({ deleted: true });
}
