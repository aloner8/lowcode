'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCoreDb } from '@/lib/db/coreDb';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { SESSION_COOKIE, sessionCookieOptionsFor, signSession, verifySession } from '@/lib/auth/session';
import { rateLimitHit, rateLimitReset } from '@/lib/security/rateLimit';
import { GlobalRole, UserProfile } from '@/types';

interface PlatformUserRow {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}

function toProfile(row: PlatformUserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name ?? row.username,
    avatarUrl: row.avatar_url ?? undefined,
    globalRole: row.global_role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function loginAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const identifier = formData.get('identifier')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!identifier || !password) {
    return { error: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน' };
  }

  // Server Actions have no Request object, so the identity is the account being
  // targeted. The database also enforces its own per-account lockout.
  const rateKey = `login:${identifier.toLowerCase()}`;
  const limit = await rateLimitHit('platform_login', rateKey);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfter / 60);
    return { error: `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารออีก ${minutes} นาที` };
  }

  let profile: UserProfile;
  try {
    const result = await getCoreDb().query<PlatformUserRow>(
      `SELECT id, username, email, full_name, avatar_url, global_role,
              is_active, must_change_password, created_at, updated_at
       FROM public.verify_platform_credentials($1, $2)`,
      [identifier, password],
    );

    if (!result.rowCount) {
      return { error: 'อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง' };
    }
    profile = toProfile(result.rows[0]);
    await rateLimitReset('platform_login', rateKey);
  } catch (error) {
    console.error('[auth] login failed', error);
    return { error: 'ไม่สามารถตรวจสอบผู้ใช้ได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล' };
  }

  const token = await signSession({
    sub: profile.id,
    username: profile.username ?? '',
    email: profile.email,
    fullName: profile.fullName ?? '',
    role: profile.globalRole,
    mustChangePassword: profile.mustChangePassword ?? false,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptionsFor(await headers()));

  await recordPlatformAudit({
    action: 'LOGIN',
    entityType: 'USER',
    entityId: profile.id,
    performedBy: profile.username ?? profile.email,
    changesSummary: `ผู้ใช้ ${profile.username ?? profile.email} เข้าสู่ระบบ`,
  });

  // Go straight to the right place. Letting this land on /admin and bounce off
  // the proxy chained two redirects inside one Server Action response, which
  // client navigation reports as "an unexpected response from the server".
  redirect(profile.mustChangePassword ? '/account/password' : '/admin');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}

/**
 * Returns the signed-in platform user, or null.
 *
 * The session cookie carries identity claims, but role and active-state are
 * re-read from the database so a revoked or demoted account loses access
 * without waiting for the cookie to expire.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  try {
    const result = await getCoreDb().query<PlatformUserRow>(
      `SELECT id, username, email, full_name, avatar_url, global_role,
              is_active, must_change_password, created_at, updated_at
       FROM public.platform_users WHERE id = $1 AND is_active = TRUE`,
      [session.sub],
    );
    if (!result.rowCount) return null;
    return toProfile(result.rows[0]);
  } catch (error) {
    console.error('[auth] unable to load current user', error);
    return null;
  }
}

export interface ImpersonationContext {
  originalFullName: string;
  originalUsername: string;
}

/** Signed display context for the persistent acting-as warning in AdminShell. */
export async function getImpersonationContext(): Promise<ImpersonationContext | null> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session?.impersonator) return null;
  return {
    originalFullName: session.impersonator.fullName || session.impersonator.username,
    originalUsername: session.impersonator.username,
  };
}

export async function changePasswordAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const currentPassword = formData.get('currentPassword')?.toString() ?? '';
  const newPassword = formData.get('newPassword')?.toString() ?? '';
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

  const user = await getCurrentUser();
  if (!user) {
    // The session can lapse between rendering this form and submitting it —
    // an expiry, a sign-out elsewhere, or a rotated AUTH_SECRET. Showing an
    // error here would leave the user on a page they can no longer use, so
    // send them to sign in and come straight back.
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    redirect('/login?redirect=%2Faccount%2Fpassword&reason=expired');
  }
  if (newPassword.length < 8) return { error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' };
  if (newPassword !== confirmPassword) return { error: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' };
  if (newPassword === currentPassword) return { error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' };

  try {
    const verified = await getCoreDb().query(
      'SELECT id FROM public.verify_platform_credentials($1, $2)',
      [user.email, currentPassword],
    );
    if (!verified.rowCount) return { error: 'รหัสผ่านเดิมไม่ถูกต้อง' };

    await getCoreDb().query('SELECT public.set_platform_user_password($1, $2)', [user.id, newPassword]);
  } catch (error) {
    console.error('[auth] unable to change password', error);
    return { error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' };
  }

  // The session cookie is stateless, so it still carries mustChangePassword:
  // re-issue it or the middleware would keep redirecting back here.
  const refreshed = await signSession({
    sub: user.id,
    username: user.username ?? '',
    email: user.email,
    fullName: user.fullName ?? '',
    role: user.globalRole,
    mustChangePassword: false,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, refreshed, sessionCookieOptionsFor(await headers()));

  await recordPlatformAudit({
    action: 'CHANGE_PASSWORD',
    entityType: 'USER',
    entityId: user.id,
    performedBy: user.username ?? user.email,
    changesSummary: `ผู้ใช้ ${user.username ?? user.email} เปลี่ยนรหัสผ่าน`,
  });

  redirect('/admin?passwordChanged=1');
}
