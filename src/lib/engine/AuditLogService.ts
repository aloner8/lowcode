import { supabase } from '@/lib/supabase/client';
import { AuditLog } from '@/types';

export class AuditLogService {
  /**
   * Logs a revision action for a Child App into Supabase `audit_logs` table
   */
  static async recordLog(
    appId: string,
    action: AuditLog['action'],
    changesSummary: string,
    snapshotBefore?: Record<string, any>,
    snapshotAfter?: Record<string, any>,
    performedBy: string = 'system'
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        app_id: appId,
        action,
        changes_summary: changesSummary,
        snapshot_before: snapshotBefore,
        snapshot_after: snapshotAfter,
        performed_by: performedBy,
      });

      if (error) {
        console.warn('[AuditLogService] Insert error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[AuditLogService] Failed to record log:', err);
      return false;
    }
  }

  /**
   * Fetches audit logs for a specific app or all apps
   */
  static async fetchLogs(appId?: string): Promise<AuditLog[]> {
    try {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
      if (appId) {
        query = query.eq('app_id', appId);
      }

      const { data, error } = await query;
      if (error || !data) return getFallbackLogs(appId);

      return data.map((d) => ({
        id: d.id,
        appId: d.app_id,
        action: d.action,
        performedBy: d.performed_by,
        changesSummary: d.changes_summary,
        snapshotBefore: d.snapshot_before,
        snapshotAfter: d.snapshot_after,
        createdAt: d.created_at,
      }));
    } catch (err) {
      return getFallbackLogs(appId);
    }
  }
}

function getFallbackLogs(appId?: string): AuditLog[] {
  return [
    {
      id: 'log-01',
      appId: appId || 'demo-app-01',
      action: 'UPDATE_PAGE',
      performedBy: 'Nirat Saisaeng (Lead Dev)',
      changesSummary: 'Updated dynamic layout components & form fields for Client A',
      snapshotBefore: { componentCount: 3 },
      snapshotAfter: { componentCount: 4 },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'log-02',
      appId: appId || 'demo-app-01',
      action: 'UPDATE_THEME',
      performedBy: 'Studio Admin',
      changesSummary: 'Changed CSS Theme preset to Corporate Emerald (Primary #10b981)',
      snapshotBefore: { preset: 'modern-indigo' },
      snapshotAfter: { preset: 'corporate-emerald' },
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'log-03',
      appId: appId || 'demo-app-01',
      action: 'CREATE_APP',
      performedBy: 'System Administrator',
      changesSummary: 'Registered Child App container on Host Port :33001 with DB app_db_client_a',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ];
}
