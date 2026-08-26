import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { isGod, requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';
import { listSites } from '@/lib/runtime/siteRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const sites = await listSites(true);
    const visible = isGod(auth.role)
      ? sites
      : await (async () => {
          const memberships = await getCoreDb().query<{ platform_id: string }>(
            'SELECT platform_id FROM public.platform_memberships WHERE user_id = $1',
            [auth.sub],
          );
          const allowed = new Set(memberships.rows.map((row) => row.platform_id));
          return sites.filter((site) => site.platformId && allowed.has(site.platformId));
        })();

    return NextResponse.json({ apps: visible });
  } catch (error) {
    console.error('Unable to load apps', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านรายการ Tenant App ได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession('GOD');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const platformId = typeof body.platformId === 'string' ? body.platformId : '';
    const appName = typeof body.appName === 'string' ? body.appName.trim() : '';
    const appSlug = typeof body.appSlug === 'string' ? body.appSlug.trim().toLowerCase() : '';
    const subdomain = typeof body.subdomain === 'string' ? body.subdomain.trim().toLowerCase() : '';
    const port = Number(body.port);

    if (!platformId || !appName || !appSlug) {
      return NextResponse.json({ error: 'กรุณาระบุ Platform, ชื่อ App และ Slug ให้ครบ' }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appSlug)) {
      return NextResponse.json({ error: 'Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง' }, { status: 400 });
    }

    const denied = await requirePlatformAccess(auth, platformId, 'ADMIN');
    if (denied) return denied;

    const created = await getCoreDb().query<{ app_id: string }>(
      'SELECT public.provision_tenant_app($1, $2, $3, $4, $5, $6) AS app_id',
      [platformId, appName, appSlug, subdomain || null, Number.isFinite(port) && port > 0 ? port : null, auth.actor],
    );

    const sites = await listSites(true);
    const app = sites.find((site) => site.appId === created.rows[0].app_id);
    return NextResponse.json({ app }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Slug, Subdomain หรือ Port นี้ถูกใช้ไปแล้ว' }, { status: 409 });
    }
    if (dbError.code === '22023' || dbError.code === '23503') {
      return NextResponse.json({ error: dbError.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    console.error('Unable to provision app', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง Tenant App ได้' }, { status: 500 });
  }
}
