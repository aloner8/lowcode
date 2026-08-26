import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireGod } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import type { SiteRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_ROLES: SiteRole[] = ['ADMIN', 'STAFF', 'VIEWER'];

/** Platform-level access grants — this is what `requirePlatformAccess` reads. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const result = await getCoreDb().query(
    `SELECT platform_id AS "platformId", platform_role AS "platformRole"
     FROM public.platform_memberships WHERE user_id = $1`,
    [id],
  );
  return NextResponse.json({ memberships: result.rows });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { memberships?: Record<string, string | null> };
    const memberships = body.memberships ?? {};

    const client = await getCoreDb().connect();
    try {
      await client.query('BEGIN');
      for (const [platformId, role] of Object.entries(memberships)) {
        if (role === null || role === '') {
          await client.query(
            'DELETE FROM public.platform_memberships WHERE user_id = $1 AND platform_id = $2',
            [id, platformId],
          );
          continue;
        }
        if (!SITE_ROLES.includes(role as SiteRole)) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: `Role ต้องเป็น ${SITE_ROLES.join(' | ')}` }, { status: 400 });
        }
        await client.query(
          `INSERT INTO public.platform_memberships (user_id, platform_id, platform_role, granted_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, platform_id) DO UPDATE SET platform_role = excluded.platform_role`,
          [id, platformId, role, auth.sub],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await recordPlatformAudit({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE_USER',
      performedBy: auth.actor,
      changesSummary: `ปรับสิทธิ์ Platform ของผู้ใช้ (${Object.keys(memberships).length} รายการ)`,
      snapshotAfter: memberships as Record<string, unknown>,
    });

    const result = await getCoreDb().query(
      `SELECT platform_id AS "platformId", platform_role AS "platformRole"
       FROM public.platform_memberships WHERE user_id = $1`,
      [id],
    );
    return NextResponse.json({ memberships: result.rows });
  } catch (error) {
    console.error('Unable to save memberships', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกสิทธิ์ได้' }, { status: 500 });
  }
}
