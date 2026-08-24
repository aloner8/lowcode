import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CategoryRow {
  id: string;
  category_code: string;
  category_name: string;
  description: string | null;
  is_active: boolean;
}

function toCategory(row: CategoryRow) {
  return {
    id: row.id,
    categoryCode: row.category_code,
    categoryName: row.category_name,
    description: row.description,
    isActive: row.is_active,
  };
}

function createCategoryCode(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = normalized || 'CATEGORY';
  const hash = createHash('sha256').update(name.toLocaleLowerCase()).digest('hex').slice(0, 8).toUpperCase();

  return `${base.slice(0, 90)}_${hash}`;
}

export async function GET() {
  try {
    const result = await getCoreDb().query<CategoryRow>(`
      SELECT id, category_code, category_name, description, is_active
      FROM public.platform_categories
      WHERE is_active = TRUE
      ORDER BY LOWER(category_name), category_name
    `);

    return NextResponse.json({ categories: result.rows.map(toCategory) });
  } catch (error) {
    console.error('Unable to load platform categories', error);
    return NextResponse.json(
      { error: 'ไม่สามารถอ่าน Category จากฐานข้อมูลได้' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { categoryName?: unknown };
    const categoryName = typeof body.categoryName === 'string' ? body.categoryName.trim() : '';

    if (!categoryName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ Category' }, { status: 400 });
    }

    if (categoryName.length > 255) {
      return NextResponse.json({ error: 'ชื่อ Category ต้องไม่เกิน 255 ตัวอักษร' }, { status: 400 });
    }

    const existing = await getCoreDb().query<CategoryRow>(
      `
        SELECT id, category_code, category_name, description, is_active
        FROM public.platform_categories
        WHERE LOWER(BTRIM(category_name)) = LOWER(BTRIM($1))
        LIMIT 1
      `,
      [categoryName],
    );

    if (existing.rowCount) {
      return NextResponse.json(
        { error: 'Category นี้มีอยู่แล้ว', category: toCategory(existing.rows[0]) },
        { status: 409 },
      );
    }

    const result = await getCoreDb().query<CategoryRow>(
      `
        INSERT INTO public.platform_categories (category_code, category_name)
        VALUES ($1, $2)
        RETURNING id, category_code, category_name, description, is_active
      `,
      [createCategoryCode(categoryName), categoryName],
    );

    return NextResponse.json({ category: toCategory(result.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error('Unable to create platform category', error);
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึก Category ลงฐานข้อมูลได้' },
      { status: 500 },
    );
  }
}
