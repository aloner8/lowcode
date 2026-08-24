import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ThemeConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlatformRow {
  id: string;
  platform_slug: string;
  platform_name: string;
  description: string | null;
  category_name: string | null;
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
    category: row.category_name ?? undefined,
    masterThemeConfig: row.master_theme_config,
    isPublished: row.is_published,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const selectPlatforms = `
  SELECT p.id, p.platform_slug, p.platform_name, p.description,
         c.category_name, p.master_theme_config, p.is_published,
         p.created_at, p.updated_at
  FROM public.platforms p
  LEFT JOIN public.platform_categories c ON c.id = p.category_id
`;

export async function GET() {
  try {
    const result = await getCoreDb().query<PlatformRow>(`${selectPlatforms} ORDER BY p.created_at, p.platform_name`);
    return NextResponse.json({ platforms: result.rows.map(toPlatform) });
  } catch (error) {
    console.error('Unable to load platforms', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่าน Platform จากฐานข้อมูลได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const platformName = typeof body.platformName === 'string' ? body.platformName.trim() : '';
    const platformSlug = typeof body.platformSlug === 'string' ? body.platformSlug.trim().toLowerCase() : '';
    const categoryName = typeof body.category === 'string' ? body.category.trim() : '';

    if (!platformName || !platformSlug || !categoryName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ Slug และ Category ให้ครบ' }, { status: 400 });
    }
    if (platformName.length > 255 || platformSlug.length > 100) {
      return NextResponse.json({ error: 'ชื่อหรือ Slug ยาวเกินกำหนด' }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(platformSlug)) {
      return NextResponse.json({ error: 'Slug ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง' }, { status: 400 });
    }

    const result = await getCoreDb().query<PlatformRow>(
      `WITH selected_category AS (
         SELECT id FROM public.platform_categories
         WHERE LOWER(BTRIM(category_name)) = LOWER(BTRIM($3)) AND is_active = TRUE
       ), inserted AS (
         INSERT INTO public.platforms
           (platform_slug, platform_name, description, category_id)
         SELECT $1, $2, $4, id FROM selected_category
         RETURNING *
       )
       SELECT i.id, i.platform_slug, i.platform_name, i.description,
              c.category_name, i.master_theme_config, i.is_published,
              i.created_at, i.updated_at
       FROM inserted i
       JOIN public.platform_categories c ON c.id = i.category_id`,
      [platformSlug, platformName, categoryName, `Master ${categoryName} Solution Blueprint`],
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: 'ไม่พบ Category ที่เลือก' }, { status: 400 });
    }
    return NextResponse.json({ platform: toPlatform(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Platform Slug นี้มีอยู่แล้ว' }, { status: 409 });
    }
    console.error('Unable to create platform', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Platform ลงฐานข้อมูลได้' }, { status: 500 });
  }
}
