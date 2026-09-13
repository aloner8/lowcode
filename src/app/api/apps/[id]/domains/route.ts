import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess, requireSiteAccess } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { addSiteDomain, listAppDomains, removeSiteDomain } from '@/lib/runtime/siteRegistry';
import { checkDomainDns } from '@/lib/runtime/domainReadiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

async function authorize(appId: string, request: Request) {
  const auth = await requireApiSession('GOD');
  if (auth instanceof NextResponse) return { response: auth };

  const app = await getCoreDb().query<{ platform_id: string | null; app_slug: string }>(
    'SELECT platform_id, app_slug FROM public.apps WHERE id = $1',
    [appId],
  );
  if (!app.rowCount) {
    return { response: NextResponse.json({ error: 'ไม่พบ Tenant App' }, { status: 404 }) };
  }
  if (app.rows[0].platform_id) {
    const denied = await requirePlatformAccess(auth, app.rows[0].platform_id, 'ADMIN');
    if (denied) return { response: denied };
  }
  return { auth, app: app.rows[0], body: request };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const denied = await requireSiteAccess(auth, id, 'VIEWER');
  if (denied) return denied;
  return NextResponse.json({ domains: await listAppDomains(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await authorize(id, request);
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as { domain?: unknown; isPrimary?: unknown };
    const domain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';

    if (!DOMAIN_PATTERN.test(domain)) {
      return NextResponse.json({ error: 'รูปแบบโดเมนไม่ถูกต้อง' }, { status: 400 });
    }

    const created = await addSiteDomain(id, domain, body.isPrimary === true);
    await recordPlatformAudit({
      platformId: guard.app!.platform_id,
      entityType: 'APP',
      entityId: id,
      action: 'UPDATE_APP',
      performedBy: guard.auth!.actor,
      changesSummary: `ผูกโดเมน ${domain} เข้ากับ ${guard.app!.app_slug}`,
    });

    return NextResponse.json({ domain: created }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'โดเมนนี้ถูกใช้กับ Site อื่นแล้ว' }, { status: 409 });
    }
    console.error('Unable to add domain', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มโดเมนได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await authorize(id, request);
  if (guard.response) return guard.response;
  const body = (await request.json()) as { domainId?: unknown; action?: unknown };
  const domainId = typeof body.domainId === 'string' ? body.domainId : '';
  if (!domainId || !['VERIFY_DNS', 'CONFIRM_PROXY'].includes(String(body.action))) {
    return NextResponse.json({ error: 'คำสั่งตรวจสอบโดเมนไม่ถูกต้อง' }, { status: 400 });
  }

  const current = await getCoreDb().query<{ domain: string; readiness_status: string; verification_token: string | null }>(
    'SELECT domain, readiness_status, verification_token FROM public.app_domains WHERE id = $1 AND app_id = $2 AND is_active = TRUE',
    [domainId, id],
  );
  if (!current.rowCount) return NextResponse.json({ error: 'ไม่พบโดเมนของ App นี้' }, { status: 404 });

  if (body.action === 'VERIFY_DNS') {
    const token = current.rows[0].verification_token;
    if (!token) return NextResponse.json({ error: 'โดเมนนี้ไม่มี token ยืนยันเจ้าของ' }, { status: 409 });
    const checked = await checkDomainDns(current.rows[0].domain, token);
    await getCoreDb().query(
      `UPDATE public.app_domains
       SET readiness_status = $3, dns_checked_at = NOW(),
           proxy_checked_at = NULL, verified_at = NULL, last_error = $4
       WHERE id = $1 AND app_id = $2`,
      [domainId, id, checked.ready ? 'PENDING_PROXY' : 'PENDING_DNS', checked.error],
    );
  } else {
    if (current.rows[0].readiness_status !== 'PENDING_PROXY') {
      return NextResponse.json({ error: 'ต้องตรวจ DNS ผ่านก่อนยืนยัน Proxy' }, { status: 409 });
    }
    await getCoreDb().query(
      `UPDATE public.app_domains
       SET readiness_status = 'READY', proxy_checked_at = NOW(), verified_at = NOW(), last_error = NULL
       WHERE id = $1 AND app_id = $2`,
      [domainId, id],
    );
  }

  await recordPlatformAudit({
    platformId: guard.app!.platform_id,
    entityType: 'APP', entityId: id, action: 'UPDATE_APP', performedBy: guard.auth!.actor,
    changesSummary: `${body.action === 'VERIFY_DNS' ? 'ตรวจ DNS' : 'ยืนยัน Proxy'} สำหรับ ${current.rows[0].domain}`,
  });
  return NextResponse.json({ domains: await listAppDomains(id) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guard = await authorize(id, request);
  if (guard.response) return guard.response;

  const domain = new URL(request.url).searchParams.get('domain') ?? '';
  if (!domain) return NextResponse.json({ error: 'ต้องระบุโดเมน' }, { status: 400 });

  const removed = await removeSiteDomain(id, domain);
  if (!removed) {
    return NextResponse.json({ error: 'ไม่พบโดเมน หรือเป็นโดเมนหลักที่ลบไม่ได้' }, { status: 400 });
  }

  await recordPlatformAudit({
    platformId: guard.app!.platform_id,
    entityType: 'APP',
    entityId: id,
    action: 'UPDATE_APP',
    performedBy: guard.auth!.actor,
    changesSummary: `ถอดโดเมน ${domain} ออกจาก ${guard.app!.app_slug}`,
  });
  return NextResponse.json({ deleted: true });
}
