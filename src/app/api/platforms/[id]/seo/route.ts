import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import { validateSeoPayload } from '@/lib/seo/validateSeo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Blueprint-level SEO defaults inherited by every site built from this platform. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const result = await getCoreDb().query(
    'SELECT seo_defaults AS "seoDefaults" FROM public.platforms WHERE id = $1',
    [id],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform' }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { seoDefaults?: unknown };
    const { value, error } = validateSeoPayload(body.seoDefaults);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const result = await getCoreDb().query(
      `UPDATE public.platforms
       SET seo_defaults = $2::jsonb, content_updated_at = NOW()
       WHERE id = $1
       RETURNING seo_defaults AS "seoDefaults"`,
      [id, JSON.stringify(value)],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Platform' }, { status: 404 });

    await recordPlatformAudit({
      platformId: id,
      entityType: 'PLATFORM',
      entityId: id,
      action: 'UPDATE_PLATFORM',
      performedBy: auth.actor,
      changesSummary: 'ปรับค่า SEO เริ่มต้นของ Platform',
      snapshotAfter: value as unknown as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Unable to save platform SEO defaults', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกค่า SEO ได้' }, { status: 500 });
  }
}
