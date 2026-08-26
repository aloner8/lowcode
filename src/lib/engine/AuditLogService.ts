import 'server-only';

import { getCoreDb } from '@/lib/db/coreDb';
import type { AuditLog, AuditLogAction, AuditLogEntityType } from '@/types';

export interface PlatformAuditInput {
  platformId?: string | null;
  entityType?: AuditLogEntityType;
  entityId?: string | null;
  action: AuditLogAction;
  performedBy: string;
  changesSummary: string;
  snapshotBefore?: Record<string, unknown> | null;
  snapshotAfter?: Record<string, unknown> | null;
}

interface AuditRow {
  id: string;
  platform_id: string | null;
  platform_name: string | null;
  entity_type: AuditLogEntityType;
  entity_id: string | null;
  action: AuditLogAction;
  performed_by: string;
  changes_summary: string;
  snapshot_before: Record<string, unknown> | null;
  snapshot_after: Record<string, unknown> | null;
  created_at: Date;
}

function toAuditLog(row: AuditRow): AuditLog {
  return {
    id: row.id,
    platformId: row.platform_id ?? undefined,
    platformName: row.platform_name ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    action: row.action,
    performedBy: row.performed_by,
    changesSummary: row.changes_summary,
    snapshotBefore: row.snapshot_before ?? undefined,
    snapshotAfter: row.snapshot_after ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Appends one entry to `public.platform_audit_logs`.
 *
 * Auditing must never break the operation being audited, so failures are logged
 * and swallowed rather than thrown.
 */
export async function recordPlatformAudit(input: PlatformAuditInput): Promise<boolean> {
  try {
    await getCoreDb().query(
      `INSERT INTO public.platform_audit_logs
         (platform_id, entity_type, entity_id, action, performed_by,
          changes_summary, snapshot_before, snapshot_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        input.platformId ?? null,
        input.entityType ?? 'PLATFORM',
        input.entityId ?? null,
        input.action,
        input.performedBy,
        input.changesSummary,
        input.snapshotBefore ? JSON.stringify(input.snapshotBefore) : null,
        input.snapshotAfter ? JSON.stringify(input.snapshotAfter) : null,
      ],
    );
    return true;
  } catch (error) {
    console.error('[audit] unable to record entry', error);
    return false;
  }
}

export interface AuditQuery {
  platformId?: string;
  entityType?: AuditLogEntityType;
  action?: string;
  limit?: number;
  offset?: number;
}

export async function fetchPlatformAudit(query: AuditQuery = {}): Promise<{ logs: AuditLog[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.platformId) {
    params.push(query.platformId);
    conditions.push(`l.platform_id = $${params.length}`);
  }
  if (query.entityType) {
    params.push(query.entityType);
    conditions.push(`l.entity_type = $${params.length}`);
  }
  if (query.action) {
    params.push(query.action);
    conditions.push(`l.action = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await getCoreDb().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.platform_audit_logs l ${where}`,
    params,
  );

  params.push(limit, offset);
  const result = await getCoreDb().query<AuditRow>(
    `SELECT l.id, l.platform_id, p.platform_name, l.entity_type, l.entity_id, l.action,
            l.performed_by, l.changes_summary, l.snapshot_before, l.snapshot_after, l.created_at
     FROM public.platform_audit_logs l
     LEFT JOIN public.platforms p ON p.id = l.platform_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { logs: result.rows.map(toAuditLog), total: Number(totalResult.rows[0]?.count ?? 0) };
}
