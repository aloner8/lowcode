import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireGod, requireSiteSession } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import type { SitePackage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PackageRow {
  package_code: string;
  package_name: string;
  package_started_at: Date;
  package_expires_at: Date | null;
  package_limits: SitePackage['limits'];
  is_suspended: boolean;
  suspended_reason: string | null;
}

const SELECT_PACKAGE = `
  SELECT package_code, package_name, package_started_at, package_expires_at,
         package_limits, is_suspended, suspended_reason
  FROM public.apps WHERE id = $1
`;

const DAY_MS = 24 * 60 * 60 * 1000;

function toPackage(row: PackageRow): SitePackage {
  const expiresAt = row.package_expires_at;
  return {
    code: row.package_code,
    name: row.package_name,
    startedAt: row.package_started_at.toISOString().slice(0, 10),
    expiresAt: expiresAt ? expiresAt.toISOString().slice(0, 10) : null,
    limits: row.package_limits ?? {},
    isSuspended: row.is_suspended,
    suspendedReason: row.suspended_reason,
    // Rounded up so "expires today" reads as 0 rather than a fraction.
    daysRemaining: expiresAt
      ? Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)
      : null,
  };
}

/** ผู้ดูแลระบบของหน่วยงานดูแพ็กเกจและวันหมดอายุของ Site ตัวเองได้ */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireSiteSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;

  const [pkg, usage] = await Promise.all([
    getCoreDb().query<PackageRow>(SELECT_PACKAGE, [id]),
    getCoreDb().query<{ seats: string; domains: string }>(
      `SELECT (SELECT COUNT(*)::text FROM public.app_memberships m WHERE m.app_id = $1) AS seats,
              (SELECT COUNT(*)::text FROM public.app_domains d WHERE d.app_id = $1 AND d.is_active) AS domains`,
      [id],
    ),
  ]);

  if (!pkg.rowCount) return NextResponse.json({ error: 'ไม่พบ Site' }, { status: 404 });

  return NextResponse.json({
    package: toPackage(pkg.rows[0]),
    usage: {
      users: Number(usage.rows[0].seats),
      domains: Number(usage.rows[0].domains),
    },
  });
}

/** เฉพาะผู้ให้บริการ (GOD) เท่านั้นที่เปลี่ยนแพ็กเกจหรือวันหมดอายุได้ */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [id];

    if (typeof body.packageCode === 'string' && body.packageCode.trim()) {
      params.push(body.packageCode.trim().toUpperCase());
      updates.push(`package_code = $${params.length}`);
    }
    if (typeof body.packageName === 'string' && body.packageName.trim()) {
      params.push(body.packageName.trim());
      updates.push(`package_name = $${params.length}`);
    }
    if (body.expiresAt !== undefined) {
      const value = body.expiresAt === null || body.expiresAt === '' ? null : String(body.expiresAt);
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return NextResponse.json({ error: 'expiresAt ต้องอยู่ในรูปแบบ YYYY-MM-DD' }, { status: 400 });
      }
      params.push(value);
      updates.push(`package_expires_at = $${params.length}::date`);
    }
    if (body.limits && typeof body.limits === 'object') {
      params.push(JSON.stringify(body.limits));
      updates.push(`package_limits = $${params.length}::jsonb`);
    }
    if (typeof body.isSuspended === 'boolean') {
      params.push(body.isSuspended);
      updates.push(`is_suspended = $${params.length}`);
      params.push(typeof body.suspendedReason === 'string' ? body.suspendedReason : null);
      updates.push(`suspended_reason = $${params.length}`);
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
    }

    const result = await getCoreDb().query<PackageRow>(
      `UPDATE public.apps SET ${updates.join(', ')} WHERE id = $1 RETURNING
         package_code, package_name, package_started_at, package_expires_at,
         package_limits, is_suspended, suspended_reason`,
      params,
    );
    if (!result.rowCount) return NextResponse.json({ error: 'ไม่พบ Site' }, { status: 404 });

    const updated = toPackage(result.rows[0]);
    await recordPlatformAudit({
      entityType: 'APP',
      entityId: id,
      action: 'UPDATE_APP',
      performedBy: auth.actor,
      changesSummary: `ปรับแพ็กเกจเป็น ${updated.name} (หมดอายุ ${updated.expiresAt ?? 'ไม่มีกำหนด'})`,
      snapshotAfter: updated as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ package: updated });
  } catch (error) {
    console.error('Unable to update site package', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกแพ็กเกจได้' }, { status: 500 });
  }
}
