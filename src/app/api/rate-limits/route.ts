import { NextResponse } from 'next/server';
import { requireGod } from '@/lib/auth/apiAuth';
import { recordPlatformAudit } from '@/lib/engine/AuditLogService';
import {
  clearLockout,
  listActiveLockouts,
  listRateLimitPolicies,
  updateRateLimitPolicy,
  validateRateLimitUpdate,
} from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rate-limit configuration.
 *
 * Only the service provider (GOD) may read or change these: a tenant raising
 * its own limits would defeat the point.
 */
export async function GET() {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  try {
    const [policies, lockouts] = await Promise.all([listRateLimitPolicies(), listActiveLockouts()]);
    return NextResponse.json({ policies, lockouts });
  } catch (error) {
    console.error('Unable to load rate limit policies', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านนโยบายจำกัดอัตราได้' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { policyKey?: unknown };
    const policyKey = typeof body.policyKey === 'string' ? body.policyKey : '';
    if (!policyKey) return NextResponse.json({ error: 'ต้องระบุ policyKey' }, { status: 400 });

    const { value, error } = validateRateLimitUpdate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const policy = await updateRateLimitPolicy(policyKey, value!, auth.actor);
    if (!policy) return NextResponse.json({ error: 'ไม่พบนโยบายที่ระบุ' }, { status: 404 });

    await recordPlatformAudit({
      entityType: 'PLATFORM',
      action: 'UPDATE_PLATFORM',
      performedBy: auth.actor,
      changesSummary:
        `ปรับนโยบายจำกัดอัตรา '${policy.label}' — ${policy.maxAttempts} ครั้ง/`
        + `${policy.windowSeconds}s ล็อก ${policy.lockoutSeconds}s`
        + `${policy.isEnabled ? '' : ' (ปิดใช้งาน)'}`,
      snapshotAfter: policy as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Unable to update rate limit policy', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกนโยบายได้' }, { status: 500 });
  }
}

/** Releases one locked-out identity early. */
export async function DELETE(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const policyKey = params.get('policyKey') ?? '';
  const identity = params.get('identity') ?? '';
  if (!policyKey || !identity) {
    return NextResponse.json({ error: 'ต้องระบุ policyKey และ identity' }, { status: 400 });
  }

  try {
    await clearLockout(policyKey, identity);
    await recordPlatformAudit({
      entityType: 'PLATFORM',
      action: 'UPDATE_PLATFORM',
      performedBy: auth.actor,
      changesSummary: `ปลดล็อก '${identity}' จากนโยบาย '${policyKey}'`,
    });
    return NextResponse.json({ cleared: true });
  } catch (error) {
    console.error('Unable to clear lockout', error);
    return NextResponse.json({ error: 'ไม่สามารถปลดล็อกได้' }, { status: 500 });
  }
}
