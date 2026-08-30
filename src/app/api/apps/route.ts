import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireApiSession, requirePlatformAccess } from '@/lib/auth/apiAuth';
import { listSites } from '@/lib/runtime/siteRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const sites = await listSites(true);
    const ownedApps = await getCoreDb().query<{ id: string }>(
      `SELECT app.id
       FROM public.apps app
       WHERE app.owner_user_id=$1
          OR EXISTS (SELECT 1 FROM public.app_memberships membership
                     WHERE membership.app_id=app.id AND membership.user_id=$1)`,
      [auth.sub],
    );
    const allowedAppIds = new Set(ownedApps.rows.map((row) => row.id));
    const visible = sites.filter((site) => allowedAppIds.has(site.appId));
    const testApps = await getCoreDb().query<{
      platform_id: string; platform_slug: string; platform_name: string;
      runtime_status: string; runtime_port: number | null; runtime_built_at: Date;
      runtime_surfaces: Record<string, { url?: string | null; port?: number | null }>;
      content_updated_at: Date; runtime_source_updated_at: Date | null;
    }>(
      `SELECT id AS platform_id,platform_slug,platform_name,runtime_status,
              runtime_port,runtime_built_at,runtime_surfaces,content_updated_at,
              runtime_source_updated_at
       FROM public.platforms
       WHERE runtime_owner_user_id=$1 AND runtime_built_at IS NOT NULL
       ORDER BY runtime_built_at DESC`,
      [auth.sub],
    );

    return NextResponse.json({
      apps: visible,
      testApps: testApps.rows.map((runtime) => ({
        platformId: runtime.platform_id,
        platformSlug: runtime.platform_slug,
        platformName: runtime.platform_name,
        status:
          !runtime.runtime_source_updated_at ||
          runtime.content_updated_at > runtime.runtime_source_updated_at
            ? "stale"
            : runtime.runtime_status,
        port: runtime.runtime_port,
        builtAt: runtime.runtime_built_at.toISOString(),
        url: runtime.runtime_port
          ? `http://localhost:${runtime.runtime_port}/app/${runtime.platform_slug}`
          : null,
        surfaces: runtime.runtime_surfaces || {},
      })),
    });
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
    await getCoreDb().query(
      `UPDATE public.apps SET owner_user_id=$2 WHERE id=$1;
       INSERT INTO public.app_memberships (user_id,app_id,app_role,granted_by)
       VALUES ($2,$1,'ADMIN',$2)
       ON CONFLICT (user_id,app_id) DO UPDATE SET app_role='ADMIN',updated_at=NOW()`,
      [created.rows[0].app_id, auth.sub],
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
