import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { SESSION_COOKIE, verifySession, type SessionPayload } from '@/lib/auth/session';
import type { AppRole, GlobalRole } from '@/types';

export interface ApiSession extends SessionPayload {
  /** Display name used for audit trails. */
  actor: string;
}

const ROLE_RANK: Record<GlobalRole, number> = { VIEWER: 0, DEVELOPER: 1, SUPER_ADMIN: 2 };
const APP_ROLE_RANK: Record<AppRole, number> = { APP_VIEWER: 0, APP_EDITOR: 1, APP_OWNER: 2 };

export const unauthorized = () =>
  NextResponse.json({ error: 'ต้องเข้าสู่ระบบก่อนใช้งาน API นี้' }, { status: 401 });

export const forbidden = (message = 'สิทธิ์ไม่เพียงพอสำหรับการดำเนินการนี้') =>
  NextResponse.json({ error: message }, { status: 403 });

/**
 * Reads the signed session cookie and re-validates it against the database so a
 * deactivated or demoted account cannot keep using an unexpired cookie.
 */
export async function getApiSession(): Promise<ApiSession | null> {
  const cookieStore = await cookies();
  const payload = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  try {
    const result = await getCoreDb().query<{ global_role: GlobalRole; username: string; email: string }>(
      'SELECT global_role, username, email FROM public.platform_users WHERE id = $1 AND is_active = TRUE',
      [payload.sub],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return { ...payload, role: row.global_role, actor: row.username || row.email };
  } catch (error) {
    console.error('[auth] unable to validate API session', error);
    return null;
  }
}

/**
 * Guard for route handlers. Returns the session, or a `NextResponse` to return
 * directly:
 *
 * ```ts
 * const auth = await requireApiSession('DEVELOPER');
 * if (auth instanceof NextResponse) return auth;
 * ```
 */
export async function requireApiSession(
  minimumRole: GlobalRole = 'VIEWER',
): Promise<ApiSession | NextResponse> {
  const session = await getApiSession();
  if (!session) return unauthorized();
  if (ROLE_RANK[session.role] < ROLE_RANK[minimumRole]) {
    return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไป`);
  }
  return session;
}

/**
 * Platform-scoped authorisation. SUPER_ADMIN passes everywhere; everyone else
 * needs a `platform_memberships` row of sufficient rank.
 */
export async function requirePlatformAccess(
  session: ApiSession,
  platformId: string,
  minimumRole: AppRole = 'APP_VIEWER',
): Promise<NextResponse | null> {
  if (session.role === 'SUPER_ADMIN') return null;

  try {
    const result = await getCoreDb().query<{ platform_role: AppRole }>(
      'SELECT platform_role FROM public.platform_memberships WHERE user_id = $1 AND platform_id = $2',
      [session.sub, platformId],
    );
    if (!result.rowCount) return forbidden('ไม่มีสิทธิ์เข้าถึง Platform นี้');
    if (APP_ROLE_RANK[result.rows[0].platform_role] < APP_ROLE_RANK[minimumRole]) {
      return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไปบน Platform นี้`);
    }
    return null;
  } catch (error) {
    console.error('[auth] unable to check platform access', error);
    return forbidden('ไม่สามารถตรวจสอบสิทธิ์ Platform ได้');
  }
}

/** Convenience wrapper: authenticate, then authorise against one platform. */
export async function requirePlatformSession(
  platformId: string,
  minimumRole: AppRole = 'APP_VIEWER',
  minimumGlobalRole: GlobalRole = 'VIEWER',
): Promise<ApiSession | NextResponse> {
  const session = await requireApiSession(minimumGlobalRole);
  if (session instanceof NextResponse) return session;
  const denied = await requirePlatformAccess(session, platformId, minimumRole);
  return denied ?? session;
}
