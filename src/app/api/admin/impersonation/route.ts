import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@/lib/db/coreDb";
import { requireGod } from "@/lib/auth/apiAuth";
import { SESSION_COOKIE, sessionCookieOptionsFor, signSession } from "@/lib/auth/session";
import { recordPlatformAudit } from "@/lib/engine/AuditLogService";

interface TargetRow {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  must_change_password: boolean;
}

export async function POST(request: NextRequest) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData();
  const targetUserId = form.get("targetUserId")?.toString().trim();
  if (!targetUserId) return NextResponse.json({ error: "ต้องระบุผู้ใช้ปลายทาง" }, { status: 400 });

  const result = await getCoreDb().query<TargetRow>(`
    SELECT id, username, email, full_name, must_change_password
    FROM public.platform_users
    WHERE id = $1 AND global_role = 'TENANT_USER' AND is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_memberships membership
        JOIN public.customers customer ON customer.id = membership.customer_id
        WHERE membership.user_id = platform_users.id
          AND customer.status IN ('SUSPENDED', 'ARCHIVED')
      )
  `, [targetUserId]);
  if (!result.rowCount) return NextResponse.json({ error: "ไม่พบผู้ใช้หน่วยงานที่เปิดใช้งาน" }, { status: 404 });
  const target = result.rows[0];
  if (target.must_change_password) {
    return NextResponse.json({ error: "ผู้ใช้นี้ต้องเปลี่ยนรหัสผ่านเริ่มต้นก่อน" }, { status: 409 });
  }

  const token = await signSession({
    sub: target.id,
    username: target.username,
    email: target.email,
    fullName: target.full_name ?? target.username,
    role: "TENANT_USER",
    mustChangePassword: false,
    impersonator: {
      sub: auth.sub,
      username: auth.username,
      email: auth.email,
      fullName: auth.fullName,
    },
  });

  await recordPlatformAudit({
    action: "START_IMPERSONATION",
    entityType: "USER",
    entityId: target.id,
    performedBy: auth.actor,
    changesSummary: `${auth.actor} เริ่มสวมสิทธิ์บัญชี ${target.username}`,
    snapshotAfter: { impersonatedUserId: target.id, impersonatedUsername: target.username },
  });

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptionsFor(request.headers));
  return response;
}
