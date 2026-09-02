import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';
import { normalizeServiceBinding } from './bindings';
import type { SharedServiceKind, StudioServiceDefinition } from '@/types';

interface BindingRow {
  binding_key: string; service_key: string; service_version: string; display_name: string; kind: SharedServiceKind;
  enabled: boolean; config: Record<string, unknown>; secret_refs: Record<string, string>; policy: StudioServiceDefinition['policy']; status: StudioServiceDefinition['status'];
}

export async function resolveAppServiceBindings(platformId: string, appId: string | undefined, baseInput: unknown): Promise<StudioServiceDefinition[]> {
  const base = (Array.isArray(baseInput) ? baseInput : []).map((entry) => normalizeServiceBinding(entry as StudioServiceDefinition));
  if (!appId) return base;
  const rows = await getCoreDb().query<BindingRow>(
    `SELECT b.binding_key,b.service_key,b.service_version,d.display_name,d.kind,b.enabled,b.config,b.secret_refs,b.policy,b.status
     FROM public.app_service_bindings b JOIN public.service_definitions d ON d.service_key=b.service_key AND d.version=b.service_version
     WHERE b.platform_id=$1 AND b.app_id=$2 ORDER BY b.binding_key`, [platformId, appId],
  );
  const merged = new Map(base.map((binding) => [binding.id, binding]));
  for (const row of rows.rows) {
    const parent = merged.get(row.binding_key);
    merged.set(row.binding_key, normalizeServiceBinding({
      ...(parent || {}), id: row.binding_key, name: parent?.name || row.display_name, kind: row.kind,
      serviceRef: { serviceKey: row.service_key, version: row.service_version }, provider: parent?.provider,
      scope: 'app', enabled: row.enabled, config: { ...(parent?.config || {}), ...(row.config || {}) },
      secretRefs: { ...(parent?.secretRefs || {}), ...(row.secret_refs || {}) }, policy: row.policy,
      status: row.status, containerBindings: parent?.containerBindings || [],
    }));
  }
  return [...merged.values()];
}
