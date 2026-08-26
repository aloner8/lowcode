import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AppRoute } from '@/types';
import { extractYiiSqlDump } from './YiiSqlDumpAdapter';
import {
  ALL_BACKEND_COLLECTION_SEEDS,
  ALL_BACKEND_FORM_SEEDS,
  type StudioCollectionDefinition,
  type StudioFormDefinition,
} from '@/lib/studio/backendFormDefinitions';

export interface YiiTargetMatch {
  routeId: string;
  legacyPath: string;
  sourceFile?: string;
  targetType?: 'form' | 'collection';
  targetId?: string;
  status: 'matched' | 'missing-view' | 'missing-definition' | 'skipped';
}

export function attachYiiOutline(routes: AppRoute[], sqlText: string): AppRoute[] {
  const menus = extractYiiSqlDump(sqlText).menus;
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const normalizeHref = (value: string) => `/${value.trim().replace(/^\/+/, '')}`;
  const menuByHref = new Map(menus.filter((menu) => menu.href && menu.href !== '#').map((menu) => [normalizeHref(menu.href), menu]));
  return routes.map((route) => {
    const menu = route.legacyPaths?.map(normalizeHref).map((href) => menuByHref.get(href)).find(Boolean);
    if (!menu) return route;
    const outlinePath: Array<{ id: string; label: string }> = [];
    const visited = new Set<string>();
    let parentId = menu.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = menuById.get(parentId);
      if (!parent) break;
      outlinePath.unshift({ id: parent.id, label: parent.label });
      parentId = parent.parentId;
    }
    return { ...route, metadata: { ...route.metadata, outlinePath } };
  });
}

const routeParts = (legacyPath: string) => {
  const pathname = new URL(legacyPath, 'https://legacy.local').pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts.some((part) => !/^[a-z0-9-]+$/i.test(part))) return null;
  return { moduleId: parts[0], controller: parts[1], action: parts[2] };
};

const normalizeSourceRoute = (value: string) => new URL(value, 'https://legacy.local').pathname;

export function recheckYiiRouteTargets(routes: AppRoute[], yiiRoot = path.join(process.cwd(), 'public', 'YII', 'yang-main')) {
  const formsToAdd = new Map<string, StudioFormDefinition>();
  const collectionsToAdd = new Map<string, StudioCollectionDefinition>();
  const matches: YiiTargetMatch[] = [];

  const updatedRoutes = routes.map((route) => {
    if (route.targetType !== 'legacy' && route.targetId) {
      matches.push({ routeId: route.id, legacyPath: route.legacyPaths?.[0] || route.path, status: 'skipped' });
      return route;
    }
    const legacyPath = route.legacyPaths?.[0];
    const parsed = legacyPath ? routeParts(legacyPath) : null;
    if (!legacyPath || !parsed) {
      matches.push({ routeId: route.id, legacyPath: legacyPath || route.path, status: 'missing-view' });
      return route;
    }

    const { moduleId, controller, action } = parsed;
    const relativeView = path.posix.join('backend', 'modules', moduleId, 'views', controller, `${action}.php`);
    const relativeForm = path.posix.join('backend', 'modules', moduleId, 'views', controller, '_form.php');
    const hasActionView = existsSync(path.join(yiiRoot, ...relativeView.split('/')));
    const hasFormView = existsSync(path.join(yiiRoot, ...relativeForm.split('/')));
    const sourceFile = action === 'create' || action === 'update' ? relativeForm : relativeView;
    if (!hasActionView && !((action === 'create' || action === 'update') && hasFormView)) {
      matches.push({ routeId: route.id, legacyPath, sourceFile, status: 'missing-view' });
      return route;
    }

    const form = ALL_BACKEND_FORM_SEEDS.find((item) =>
      item.moduleId === moduleId && (
        normalizeSourceRoute(item.source.routeCreate) === normalizeSourceRoute(legacyPath)
        || normalizeSourceRoute(item.source.routeUpdate) === normalizeSourceRoute(legacyPath)
        || item.source.formView.replace(/\\/g, '/') === relativeForm
      ),
    );
    const collection = (form && ALL_BACKEND_COLLECTION_SEEDS.find((item) => item.id === form.collectionId))
      || ALL_BACKEND_COLLECTION_SEEDS.find((item) => item.id === `${moduleId}.${controller}.collection`);
    const wantsForm = action === 'create' || action === 'update';
    const target = wantsForm ? form : collection;
    if (!target) {
      matches.push({ routeId: route.id, legacyPath, sourceFile, status: 'missing-definition' });
      return route;
    }

    if (form) formsToAdd.set(form.id, form);
    if (collection) collectionsToAdd.set(collection.id, collection);
    const targetType = wantsForm ? 'form' as const : 'collection' as const;
    matches.push({ routeId: route.id, legacyPath, sourceFile, targetType, targetId: target.id, status: 'matched' });
    return {
      ...route,
      targetType,
      targetId: target.id,
      metadata: { ...route.metadata, yiiRecheck: { sourceFile, checkedAt: new Date().toISOString() } },
    };
  });

  return { updatedRoutes, matches, formsToAdd: [...formsToAdd.values()], collectionsToAdd: [...collectionsToAdd.values()] };
}
