import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { isGod, requireApiSession, requireGod } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { FirstPublicPageMode, ThemeConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIRST_PAGE_MODES: FirstPublicPageMode[] = ['PUBLIC_HOME', 'PUBLIC_HOME_WITH_LOGIN', 'LOGIN_PAGE'];

interface PlatformRow {
  id: string;
  platform_slug: string;
  platform_name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  first_public_page: FirstPublicPageMode;
  master_theme_config: ThemeConfig;
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}

function toPlatform(row: PlatformRow) {
  return {
    id: row.id,
    platformSlug: row.platform_slug,
    platformName: row.platform_name,
    description: row.description ?? undefined,
    categoryId: row.category_id ?? undefined,
    category: row.category_name ?? undefined,
    firstPublicPage: row.first_public_page,
    masterThemeConfig: row.master_theme_config,
    isPublished: row.is_published,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectPlatforms = `
  SELECT p.id, p.platform_slug, p.platform_name, p.description, p.category_id,
         c.category_name, p.first_public_page, p.master_theme_config, p.is_published,
         p.created_at, p.updated_at
  FROM public.platforms p
  LEFT JOIN public.platform_categories c ON c.id = p.category_id
`;

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  try {
    // Only the service provider sees every blueprint; everyone else sees
    // the platforms they hold a membership on.
    const scoped = isGod(auth.role)
      ? await getCoreDb().query<PlatformRow>(`${selectPlatforms} ORDER BY p.created_at, p.platform_name`)
      : await getCoreDb().query<PlatformRow>(
          `${selectPlatforms}
           JOIN public.platform_memberships m ON m.platform_id = p.id AND m.user_id = $1
           ORDER BY p.created_at, p.platform_name`,
          [auth.sub],
        );
    return NextResponse.json({ platforms: scoped.rows.map(toPlatform) });
  } catch (error) {
    console.error('Unable to load platforms', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่าน Platform จากฐานข้อมูลได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const platformName = typeof body.platformName === 'string' ? body.platformName.trim() : '';
    const platformSlug = typeof body.platformSlug === 'string' ? body.platformSlug.trim().toLowerCase() : '';
    const categoryName = typeof body.category === 'string' ? body.category.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const firstPublicPage = typeof body.firstPublicPage === 'string' ? body.firstPublicPage : '';

    if (!platformName || !platformSlug || !categoryName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ Slug และ Category ให้ครบ' }, { status: 400 });
    }
    if (platformName.length > 255 || platformSlug.length > 100) {
      return NextResponse.json({ error: 'ชื่อหรือ Slug ยาวเกินกำหนด' }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(platformSlug)) {
      return NextResponse.json({ error: 'Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง' }, { status: 400 });
    }
    if (!FIRST_PAGE_MODES.includes(firstPublicPage as FirstPublicPageMode)) {
      return NextResponse.json(
        { error: `First Public Page ต้องเป็นค่า ${FIRST_PAGE_MODES.join(' | ')}` },
        { status: 400 },
      );
    }

    const category = await getCoreDb().query<{ id: string }>(
      `SELECT id FROM public.platform_categories
       WHERE LOWER(BTRIM(category_name)) = LOWER(BTRIM($1)) AND is_active = TRUE LIMIT 1`,
      [categoryName],
    );
    if (!category.rowCount) {
      return NextResponse.json({ error: 'ไม่พบ Category ที่เลือก' }, { status: 400 });
    }

    // One transactional procedure creates the platform plus its modules, pages,
    // entry flow and audit entry — or rolls the whole thing back.
    const created = await getCoreDb().query<{ platform_id: string }>(
      'SELECT public.create_platform_blueprint($1, $2, $3, $4::public.first_public_page_mode, $5, $6) AS platform_id',
      [platformName, platformSlug, category.rows[0].id, firstPublicPage, description || null, auth.actor],
    );

    const result = await getCoreDb().query<PlatformRow>(
      `${selectPlatforms} WHERE p.id = $1`,
      [created.rows[0].platform_id],
    );
    return NextResponse.json({ platform: toPlatform(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Platform Slug นี้มีอยู่แล้ว' }, { status: 409 });
    }
    if (dbError.code === '22023' || dbError.code === '23503') {
      return NextResponse.json({ error: dbError.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    console.error('Unable to create platform', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Platform ลงฐานข้อมูลได้' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const platformId = new URL(request.url).searchParams.get('id');
  if (!platformId) return NextResponse.json({ error: 'ต้องระบุ Platform ID' }, { status: 400 });

  try {
    const existing = await getCoreDb().query<PlatformRow>(`${selectPlatforms} WHERE p.id = $1`, [platformId]);
    if (!existing.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform ที่เลือก' }, { status: 404 });

    await getCoreDb().query('DELETE FROM public.platforms WHERE id = $1', [platformId]);
    await recordPlatformAudit({
      entityType: 'PLATFORM',
      entityId: platformId,
      action: 'DELETE_PLATFORM',
      performedBy: auth.actor,
      changesSummary: `ลบ Platform "${existing.rows[0].platform_name}"`,
      snapshotBefore: toPlatform(existing.rows[0]) as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Unable to delete platform', error);
    return NextResponse.json({ error: 'ไม่สามารถลบ Platform ได้' }, { status: 500 });
  }
}
