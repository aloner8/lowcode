import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import { SESSION_COOKIE, sessionCookieOptionsFor, signSession, verifySession } from "@/lib/auth/session";
import { recordPlatformAudit } from "@/lib/engine/AuditLogService";

interface GodRow {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  must_change_password: boolean;
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session?.impersonator) {
    return NextResponse.json({ error: "ไม่มีการสวมสิทธิ์ที่กำลังทำงาน" }, { status: 409 });
  }

  const result = await getCoreDb().query<GodRow>(`
    SELECT id, username, email, full_name, must_change_password
    FROM public.platform_users
    WHERE id = $1 AND global_role = 'GOD' AND is_active = TRUE
  `, [session.impersonator.sub]);
  if (!result.rowCount) {
    return NextResponse.json({ error: "บัญชี Admin เดิมไม่พร้อมใช้งาน" }, { status: 403 });
  }
  const original = result.rows[0];
  const token = await signSession({
    sub: original.id,
    username: original.username,
    email: original.email,
    fullName: original.full_name ?? original.username,
    role: "GOD",
    mustChangePassword: original.must_change_password,
  });

  await recordPlatformAudit({
    action: "END_IMPERSONATION",
    entityType: "USER",
    entityId: session.sub,
    performedBy: original.username,
    changesSummary: `${original.username} หยุดสวมสิทธิ์บัญชี ${session.username}`,
    snapshotBefore: { impersonatedUserId: session.sub, impersonatedUsername: session.username },
  });

  const response = NextResponse.redirect(new URL("/admin/customers", request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptionsFor(request.headers));
  return response;
}
