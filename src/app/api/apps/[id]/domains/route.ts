import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { addSiteDomain, findSiteBySlug, removeSiteDomain } from '@/lib/runtime/siteRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

async function authorize(appId: string, request: Request) {
  const auth = await requireApiSession('DEVELOPER');
  if (auth instanceof NextResponse) return { response: auth };

  const app = await getCoreDb().query<{ platform_id: string | null; app_slug: string }>(
    'SELECT platform_id, app_slug FROM public.apps WHERE id = $1',
    [appId],
  );
  if (!app.rowCount) {
    return { response: NextResponse.json({ error: 'ไม่พบ Tenant App' }, { status: 404 }) };
  }
  if (app.rows[0].platform_id) {
    const denied = await requirePlatformAccess(auth, app.rows[0].platform_id, 'APP_OWNER');
    if (denied) return { response: denied };
  }
  return { auth, app: app.rows[0], body: request };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession('VIEWER');
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const result = await getCoreDb().query(
    `SELECT id, domain, is_primary AS "isPrimary", force_https AS "forceHttps",
            is_active AS "isActive", created_at AS "createdAt"
     FROM public.app_domains WHERE app_id = $1 ORDER BY is_primary DESC, domain`,
    [id],
  );
  return NextResponse.json({ domains: result.rows });
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

    await addSiteDomain(id, domain, body.isPrimary === true);
    await recordPlatformAudit({
      platformId: guard.app!.platform_id,
      entityType: 'APP',
      entityId: id,
      action: 'UPDATE_APP',
      performedBy: guard.auth!.actor,
      changesSummary: `ผูกโดเมน ${domain} เข้ากับ ${guard.app!.app_slug}`,
    });

    return NextResponse.json({ site: await findSiteBySlug(guard.app!.app_slug) }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'โดเมนนี้ถูกใช้กับ Site อื่นแล้ว' }, { status: 409 });
    }
    console.error('Unable to add domain', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มโดเมนได้' }, { status: 500 });
  }
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
