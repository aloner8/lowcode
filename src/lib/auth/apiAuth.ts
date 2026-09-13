import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { SESSION_COOKIE, verifySession, type SessionPayload } from '@/lib/auth/session';
import type {
  CustomerRole,
  EffectiveCustomerRole,
  EffectiveRole,
  GlobalRole,
  SiteRole,
} from '@/types';
import { findCustomerAccessBlock } from '@/lib/auth/customerAccess';

/**
 * Authorisation for API route handlers.
 *
 *   GOD    ผู้ให้บริการ (หนุมานไอที) — ทุก Site ทุก Platform
 *   ADMIN  ผู้ดูแลระบบของหน่วยงาน — เฉพาะ Site ของตัวเอง
 *   STAFF  พนักงานหน่วยงาน — เนื้อหาของ Site ตัวเอง
 *   VIEWER อ่านอย่างเดียว
 *
 * GOD is a property of the account; ADMIN/STAFF/VIEWER are always scoped to a
 * single Site and read from `app_memberships`.
 */

export interface ApiSession extends SessionPayload {
  /** Display name used for audit trails. */
  actor: string;
}

/** VIEWER < STAFF < ADMIN < GOD */
const ROLE_RANK: Record<EffectiveRole, number> = { VIEWER: 0, STAFF: 1, ADMIN: 2, GOD: 3 };
const CUSTOMER_ROLE_RANK: Record<EffectiveCustomerRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  OWNER: 2,
  GOD: 3,
};

export const isGod = (role: GlobalRole) => role === 'GOD';

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
    const result = await getCoreDb().query<{
      global_role: GlobalRole; username: string; email: string; must_change_password: boolean;
    }>(
      `SELECT global_role, username, email, must_change_password
       FROM public.platform_users WHERE id = $1 AND is_active = TRUE`,
      [payload.sub],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    if (await findCustomerAccessBlock(payload.sub, row.global_role)) return null;
    return {
      ...payload,
      role: row.global_role,
      // Re-read rather than trusting the cookie, which may predate a reset.
      mustChangePassword: row.must_change_password,
      actor: row.username || row.email,
    };
  } catch (error) {
    console.error('[auth] unable to validate API session', error);
    return null;
  }
}

/**
 * Requires a signed-in account.
 *
 * ```ts
 * const auth = await requireApiSession();
 * if (auth instanceof NextResponse) return auth;
 * ```
 */
export async function requireApiSession(
  minimumGlobalRole?: GlobalRole,
): Promise<ApiSession | NextResponse> {
  const session = await getApiSession();
  if (!session) return unauthorized();

  if (session.mustChangePassword) {
    return NextResponse.json(
      { error: 'ต้องเปลี่ยนรหัสผ่านเริ่มต้นก่อนใช้งาน', redirect: '/account/password' },
      { status: 403 },
    );
  }
  if (minimumGlobalRole === 'GOD' && !isGod(session.role)) {
    return forbidden('เฉพาะผู้ให้บริการ (GOD) เท่านั้นที่ทำรายการนี้ได้');
  }
  return session;
}

/** Requires an account belonging to the service provider. */
export const requireGod = () => requireApiSession('GOD');

/** Effective role of the signed-in account on one Site. */
export async function siteRoleOf(session: ApiSession, appId: string): Promise<EffectiveRole | null> {
  if (isGod(session.role)) return 'GOD';

  const result = await getCoreDb().query<{ app_role: SiteRole }>(
    'SELECT app_role FROM public.app_memberships WHERE user_id = $1 AND app_id = $2',
    [session.sub, appId],
  );
  return result.rowCount ? result.rows[0].app_role : null;
}

/** Site-scoped authorisation: the caller must hold `minimumRole` on that Site. */
export async function requireSiteAccess(
  session: ApiSession,
  appId: string,
  minimumRole: SiteRole = 'VIEWER',
): Promise<NextResponse | null> {
  try {
    const role = await siteRoleOf(session, appId);
    if (!role) return forbidden('ไม่มีสิทธิ์เข้าถึง Site นี้');
    if (ROLE_RANK[role] < ROLE_RANK[minimumRole]) {
      return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไปบน Site นี้`);
    }
    return null;
  } catch (error) {
    console.error('[auth] unable to check site access', error);
    return forbidden('ไม่สามารถตรวจสอบสิทธิ์ Site ได้');
  }
}

/** Convenience wrapper: authenticate, then authorise against one Site. */
export async function requireSiteSession(
  appId: string,
  minimumRole: SiteRole = 'VIEWER',
): Promise<ApiSession | NextResponse> {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const denied = await requireSiteAccess(session, appId, minimumRole);
  return denied ?? session;
}

/**
 * Platform-scoped authorisation.
 *
 * A Platform Master is a blueprint owned by the service provider, so GOD always
 * passes; other accounts need a `platform_memberships` row of sufficient rank.
 */
export async function requirePlatformAccess(
  session: ApiSession,
  platformId: string,
  minimumRole: SiteRole = 'VIEWER',
): Promise<NextResponse | null> {
  if (isGod(session.role)) return null;

  try {
    const result = await getCoreDb().query<{ platform_role: SiteRole }>(
      'SELECT platform_role FROM public.platform_memberships WHERE user_id = $1 AND platform_id = $2',
      [session.sub, platformId],
    );
    if (!result.rowCount) return forbidden('ไม่มีสิทธิ์เข้าถึง Platform นี้');
    if (ROLE_RANK[result.rows[0].platform_role] < ROLE_RANK[minimumRole]) {
      return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไปบน Platform นี้`);
    }
    return null;
  } catch (error) {
    console.error('[auth] unable to check platform access', error);
    return forbidden('ไม่สามารถตรวจสอบสิทธิ์ Platform ได้');
  }
}

/** Convenience wrapper: authenticate, then authorise against one Platform. */
export async function requirePlatformSession(
  platformId: string,
  minimumRole: SiteRole = 'VIEWER',
): Promise<ApiSession | NextResponse> {
  const session = await requireApiSession();
  if (session instanceof NextResponse) return session;
  const denied = await requirePlatformAccess(session, platformId, minimumRole);
  return denied ?? session;
}

/** Effective role on a Customer account. App memberships never grant this role. */
export async function customerRoleOf(
  session: ApiSession,
  customerId: string,
): Promise<EffectiveCustomerRole | null> {
  if (isGod(session.role)) return 'GOD';

  const result = await getCoreDb().query<{ customer_role: CustomerRole }>(
    `SELECT membership.customer_role
     FROM public.customer_memberships membership
     JOIN public.customers customer ON customer.id = membership.customer_id
     WHERE membership.user_id = $1
       AND membership.customer_id = $2
       AND customer.status = 'ACTIVE'`,
    [session.sub, customerId],
  );
  return result.rowCount ? result.rows[0].customer_role : null;
}

export async function requireCustomerAccess(
  session: ApiSession,
  customerId: string,
  minimumRole: CustomerRole = 'VIEWER',
): Promise<NextResponse | null> {
  try {
    const role = await customerRoleOf(session, customerId);
    if (!role) return forbidden('ไม่มีสิทธิ์เข้าถึง Customer นี้');
    if (CUSTOMER_ROLE_RANK[role] < CUSTOMER_ROLE_RANK[minimumRole]) {
      return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไปบน Customer นี้`);
    }
    return null;
  } catch (error) {
    console.error('[auth] unable to check customer access', error);
    return forbidden('ไม่สามารถตรวจสอบสิทธิ์ Customer ได้');
  }
}

export async function templateRoleOf(
  session: ApiSession,
  templateId: string,
): Promise<EffectiveCustomerRole | null> {
  if (isGod(session.role)) return 'GOD';

  const result = await getCoreDb().query<{ customer_role: CustomerRole }>(
    `SELECT membership.customer_role
     FROM public.templates template
     JOIN public.customers customer ON customer.id = template.customer_id
     JOIN public.customer_memberships membership
       ON membership.customer_id = customer.id
      AND membership.user_id = $1
     WHERE template.id = $2
       AND template.archived_at IS NULL
       AND customer.status = 'ACTIVE'`,
    [session.sub, templateId],
  );
  return result.rowCount ? result.rows[0].customer_role : null;
}

export async function requireTemplateAccess(
  session: ApiSession,
  templateId: string,
  minimumRole: CustomerRole = 'VIEWER',
): Promise<NextResponse | null> {
  try {
    const role = await templateRoleOf(session, templateId);
    if (!role) return forbidden('ไม่มีสิทธิ์เข้าถึง Template นี้');
    if (CUSTOMER_ROLE_RANK[role] < CUSTOMER_ROLE_RANK[minimumRole]) {
      return forbidden(`ต้องมีสิทธิ์ระดับ ${minimumRole} ขึ้นไปบน Template นี้`);
    }
    return null;
  } catch (error) {
    console.error('[auth] unable to check template access', error);
    return forbidden('ไม่สามารถตรวจสอบสิทธิ์ Template ได้');
  }
}
