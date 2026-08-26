import type { AppRoute, ComponentNode } from '@/types';
import type { MenuConversionPatch } from './types';

type JsonObject = Record<string, unknown>;

const migrationKey = (route: AppRoute) => {
  const migration = route.metadata?.migration;
  return migration ? `${migration.sourceSystemId}:${migration.sourceKey}` : `route:${route.id}`;
};

export function mergeConvertedRoutes(existing: AppRoute[], incoming: AppRoute[]) {
  const incomingByKey = new Map(incoming.map((route) => [migrationKey(route), route]));
  let created = 0; let updated = 0; let unchanged = 0;
  const merged = existing.map((route) => {
    const next = incomingByKey.get(migrationKey(route));
    if (!next) return route;
    incomingByKey.delete(migrationKey(route));
    if (JSON.stringify(route) === JSON.stringify(next)) { unchanged += 1; return route; }
    updated += 1;
    return { ...route, ...next, metadata: { ...route.metadata, ...next.metadata } };
  });
  for (const route of incomingByKey.values()) { merged.push(route); created += 1; }
  return { routes: merged, created, updated, unchanged };
}

export function applyMenuPatchesToPages<T extends { componentTree?: ComponentNode[] }>(pages: T[], patches: MenuConversionPatch[], preserveLegacyHref = true): T[] {
  const byHref = new Map(patches.map((patch) => [patch.legacyHref, patch]));
  const patchItems = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(patchItems);
    if (!value || typeof value !== 'object') return value;
    const item = value as JsonObject;
    const patch = typeof item.href === 'string' ? byHref.get(item.href) : undefined;
    const next = Object.fromEntries(Object.entries(item).map(([key, child]) => [key, patchItems(child)]));
    if (!patch) return next;
    next.action = patch.action;
    next.routeId = patch.routeId;
    if (!preserveLegacyHref) delete next.href;
    return next;
  };
  return pages.map((page) => ({ ...page, componentTree: patchItems(page.componentTree || []) as ComponentNode[] }));
}
