import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireGod } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { PLATFORM_USER_COLUMNS, toUser, type PlatformUserRow } from '@/lib/auth/platformUsers';
import type { GlobalRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES: GlobalRole[] = ['GOD', 'TENANT_USER'];

const SELECT_USERS = `SELECT ${PLATFORM_USER_COLUMNS} FROM public.platform_users`;

export async function GET() {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await getCoreDb().query<PlatformUserRow>(`${SELECT_USERS} ORDER BY created_at`);
    return NextResponse.json({ users: result.rows.map(toUser) });
  } catch (error) {
    console.error('Unable to load users', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านรายชื่อผู้ใช้ได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const globalRole = typeof body.globalRole === 'string' ? body.globalRole : 'TENANT_USER';

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'กรุณาระบุ Username, Email และรหัสผ่าน' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }
    if (!ROLES.includes(globalRole as GlobalRole)) {
      return NextResponse.json({ error: `Role ต้องเป็น ${ROLES.join(' | ')}` }, { status: 400 });
    }

    const result = await getCoreDb().query<PlatformUserRow>(
      `INSERT INTO public.platform_users
         (username, email, full_name, password_hash, global_role, must_change_password)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf', 12)), $5, TRUE)
       RETURNING ${PLATFORM_USER_COLUMNS}`,
      [username, email, fullName || username, password, globalRole],
    );

    const user = toUser(result.rows[0]);
    await recordPlatformAudit({
      entityType: 'USER',
      entityId: user.id,
      action: 'CREATE_USER',
      performedBy: auth.actor,
      changesSummary: `สร้างผู้ใช้ ${user.username} (${user.globalRole})`,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Username หรือ Email นี้ถูกใช้ไปแล้ว' }, { status: 409 });
    }
    console.error('Unable to create user', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างผู้ใช้ได้' }, { status: 500 });
  }
}
