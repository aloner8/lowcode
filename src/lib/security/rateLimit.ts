import 'server-only';

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

/**
 * Rate limiting.
 *
 * Policies live in `public.rate_limit_policies` so the service provider (GOD)
 * can tune them from /admin/security without a deploy, and counters live in the
 * database so they hold across the many processes a multi-site deployment runs.
 *
 * The check fails open: if the database is unreachable, requests are allowed
 * rather than the whole platform locking itself out.
 */

export type RateLimitPolicyKey =
  | 'platform_login'
  | 'tenant_login'
  | 'public_write'
  | 'public_read';

export interface RateLimitPolicy {
  policyKey: RateLimitPolicyKey;
  label: string;
  description: string | null;
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
  isEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in the window; -1 when the policy is disabled. */
  remaining: number;
  /** Seconds until the caller may retry; 0 when it is not locked out. */
  retryAfter: number;
}

/**
 * Identifies the caller.
 *
 * Proxy headers are attacker-controlled, so only the first hop of
 * `x-forwarded-for` is used and it is capped in length.
 */
export function clientIdentity(request: Request, suffix?: string): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = (forwarded.split(',')[0] || request.headers.get('x-real-ip') || 'unknown')
    .trim()
    .slice(0, 64);
  return suffix ? `${ip}|${suffix.toLowerCase().slice(0, 160)}` : ip;
}

/** Records an attempt and reports whether it is allowed. */
export async function rateLimitHit(
  policyKey: RateLimitPolicyKey,
  identity: string,
): Promise<RateLimitResult> {
  try {
    const result = await getCoreDb().query<{ allowed: boolean; remaining: number; retry_after: number }>(
      'SELECT allowed, remaining, retry_after FROM public.rate_limit_hit($1, $2)',
      [policyKey, identity],
    );
    const row = result.rows[0];
    return {
      allowed: row?.allowed ?? true,
      remaining: row?.remaining ?? -1,
      retryAfter: row?.retry_after ?? 0,
    };
  } catch (error) {
    console.error(`[rate-limit] '${policyKey}' check failed — allowing the request`, error);
    return { allowed: true, remaining: -1, retryAfter: 0 };
  }
}

/** Clears the counter after a legitimate success. */
export async function rateLimitReset(policyKey: RateLimitPolicyKey, identity: string): Promise<void> {
  try {
    await getCoreDb().query('SELECT public.rate_limit_reset($1, $2)', [policyKey, identity]);
  } catch (error) {
    console.error(`[rate-limit] unable to reset '${policyKey}'`, error);
  }
}

/**
 * Guard for route handlers:
 *
 * ```ts
 * const limited = await enforceRateLimit('tenant_login', clientIdentity(request, email));
 * if (limited) return limited;
 * ```
 */
export async function enforceRateLimit(
  policyKey: RateLimitPolicyKey,
  identity: string,
  message = 'มีการเรียกใช้งานถี่เกินกำหนด กรุณาลองใหม่อีกครั้งภายหลัง',
): Promise<NextResponse | null> {
  const result = await rateLimitHit(policyKey, identity);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: message, retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

interface PolicyRow {
  policy_key: RateLimitPolicyKey;
  label: string;
  description: string | null;
  max_attempts: number;
  window_seconds: number;
  lockout_seconds: number;
  is_enabled: boolean;
  updated_by: string;
  updated_at: Date;
}

const toPolicy = (row: PolicyRow): RateLimitPolicy => ({
  policyKey: row.policy_key,
  label: row.label,
  description: row.description,
  maxAttempts: row.max_attempts,
  windowSeconds: row.window_seconds,
  lockoutSeconds: row.lockout_seconds,
  isEnabled: row.is_enabled,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at.toISOString(),
});

export async function listRateLimitPolicies(): Promise<RateLimitPolicy[]> {
  const result = await getCoreDb().query<PolicyRow>(
    `SELECT policy_key, label, description, max_attempts, window_seconds,
            lockout_seconds, is_enabled, updated_by, updated_at
     FROM public.rate_limit_policies ORDER BY policy_key`,
  );
  return result.rows.map(toPolicy);
}

export interface RateLimitUpdate {
  maxAttempts?: number;
  windowSeconds?: number;
  lockoutSeconds?: number;
  isEnabled?: boolean;
}

/** Bounds match the CHECK constraints, so a bad value is refused before the query. */
export function validateRateLimitUpdate(input: unknown): { value?: RateLimitUpdate; error?: string } {
  if (!input || typeof input !== 'object') return { error: 'ข้อมูลนโยบายไม่ถูกต้อง' };
  const raw = input as Record<string, unknown>;
  const value: RateLimitUpdate = {};

  const number = (key: 'maxAttempts' | 'windowSeconds' | 'lockoutSeconds', min: number, max: number, label: string) => {
    if (raw[key] === undefined) return null;
    const parsed = Number(raw[key]);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      return `${label} ต้องเป็นจำนวนเต็มระหว่าง ${min} ถึง ${max}`;
    }
    value[key] = parsed;
    return null;
  };

  const error =
    number('maxAttempts', 1, 10_000, 'จำนวนครั้งสูงสุด')
    || number('windowSeconds', 10, 86_400, 'ช่วงเวลานับ (วินาที)')
    || number('lockoutSeconds', 0, 86_400, 'ระยะเวลาล็อก (วินาที)');
  if (error) return { error };

  if (raw.isEnabled !== undefined) {
    if (typeof raw.isEnabled !== 'boolean') return { error: 'isEnabled ต้องเป็น true หรือ false' };
    value.isEnabled = raw.isEnabled;
  }

  if (Object.keys(value).length === 0) return { error: 'ไม่มีข้อมูลที่ต้องแก้ไข' };
  return { value };
}

export async function updateRateLimitPolicy(
  policyKey: string,
  update: RateLimitUpdate,
  updatedBy: string,
): Promise<RateLimitPolicy | null> {
  const assignments: string[] = [];
  const params: unknown[] = [policyKey];

  const push = (column: string, value: unknown) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (update.maxAttempts !== undefined) push('max_attempts', update.maxAttempts);
  if (update.windowSeconds !== undefined) push('window_seconds', update.windowSeconds);
  if (update.lockoutSeconds !== undefined) push('lockout_seconds', update.lockoutSeconds);
  if (update.isEnabled !== undefined) push('is_enabled', update.isEnabled);
  push('updated_by', updatedBy);

  const result = await getCoreDb().query<PolicyRow>(
    `UPDATE public.rate_limit_policies SET ${assignments.join(', ')}
     WHERE policy_key = $1
     RETURNING policy_key, label, description, max_attempts, window_seconds,
               lockout_seconds, is_enabled, updated_by, updated_at`,
    params,
  );
  return result.rowCount ? toPolicy(result.rows[0]) : null;
}

/** Currently locked-out identities, shown to GOD for troubleshooting. */
export async function listActiveLockouts(): Promise<
  Array<{ policyKey: string; identity: string; attempts: number; lockedUntil: string }>
> {
  const result = await getCoreDb().query<{
    policy_key: string; identity: string; attempts: number; locked_until: Date;
  }>(
    `SELECT policy_key, identity, attempts, locked_until
     FROM public.rate_limit_attempts
     WHERE locked_until > NOW()
     ORDER BY locked_until DESC LIMIT 50`,
  );
  return result.rows.map((row) => ({
    policyKey: row.policy_key,
    identity: row.identity,
    attempts: row.attempts,
    lockedUntil: row.locked_until.toISOString(),
  }));
}

export async function clearLockout(policyKey: string, identity: string): Promise<void> {
  await getCoreDb().query(
    'DELETE FROM public.rate_limit_attempts WHERE policy_key = $1 AND identity = $2',
    [policyKey, identity],
  );
}
