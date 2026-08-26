import { createHash } from 'node:crypto';
import type { AppRoute } from '@/types';
import { extractYiiSqlDump } from './YiiSqlDumpAdapter';
import type { ConversionIssue, YiiRouteConversionInput, YiiRouteConversionResult } from './types';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route';
const normalizeLegacyPath = (href: string) => {
  const value = href.trim();
  if (!value || value === '#') return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/${value.replace(/^\/+/, '')}`;
};
const canonicalPath = (legacyPath: string) => {
  const parsed = new URL(legacyPath, 'https://legacy.local');
  const segments = parsed.pathname.split('/').filter(Boolean);
  const controller = slugify(segments.at(-2) || segments[0] || 'page');
  const action = slugify(segments.at(-1) || 'index');
  const id = parsed.searchParams.get('id');
  if (action === 'index') return id ? `/${controller}/category/${encodeURIComponent(id)}` : `/${controller}`;
  if (action === 'view') return id ? `/${controller}/${encodeURIComponent(id)}` : `/${controller}`;
  if (action === 'create') return `/${controller}/new`;
  if (action === 'update') return id ? `/${controller}/${encodeURIComponent(id)}/edit` : `/${controller}/edit`;
  return `/${controller}/${action}${id ? `/${encodeURIComponent(id)}` : ''}`;
};

export function convertYiiRoutes(input: YiiRouteConversionInput): YiiRouteConversionResult {
  const sourceFingerprint = `sha256:${hash(input.sqlText)}`;
  const normalized = extractYiiSqlDump(input.sqlText);
  const menuById = new Map(normalized.menus.map((menu) => [menu.id, menu]));
  const issues: ConversionIssue[] = []; const routes: AppRoute[] = []; const menuPatches: YiiRouteConversionResult['menuPatches'] = [];
  const overrides = new Map((input.mappingOverrides || []).map((item) => [item.sourceKey, item]));
  const pathOwners = new Map<string, string>();
  for (const menu of normalized.menus) {
    const legacyPath = normalizeLegacyPath(menu.href);
    if (!legacyPath) continue;
    const override = overrides.get(menu.sourceKey);
    const external = /^https?:\/\//i.test(legacyPath);
    const defaultContainer = menu.location === 'top' || external ? input.options.targetContainers.frontend : input.options.targetContainers.backend;
    let path = override?.path || (external ? `/external/${slugify(menu.label)}-${menu.id}` : canonicalPath(legacyPath));
    const ownerKey = `${override?.containerName || defaultContainer}:${path}`;
    if (pathOwners.has(ownerKey)) path = `${path}-${menu.id}`;
    pathOwners.set(`${override?.containerName || defaultContainer}:${path}`, menu.sourceKey);
    const routeId = `route.yii.${slugify(input.sourceSystemId)}.${menu.id}`;
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
    routes.push({
      id: routeId, platformId: input.platformId, containerName: override?.containerName || defaultContainer,
      path, label: menu.label, targetType: override?.targetType || (external ? 'external' : 'legacy'), targetId: override?.targetId,
      legacyPaths: external ? [] : [legacyPath], externalUrl: external ? legacyPath : undefined, isPublic: external || menu.location === 'top',
      metadata: { outlinePath, migration: { sourceSystemId: input.sourceSystemId, sourceKey: menu.sourceKey, sourceFingerprint, rulesVersion: input.options.rulesVersion, managedFields: ['legacyPaths', 'targetType', 'targetId', 'externalUrl', 'metadata.outlinePath'] } },
    });
    menuPatches.push({ sourceKey: menu.sourceKey, menuId: menu.id, legacyHref: menu.href, routeId, action: { type: 'openRoute', routeId } });
  }
  if (!normalized.menus.length) issues.push({ severity: 'error', code: 'CMS_MENU_NOT_FOUND', message: 'No cms_menu INSERT statements were found in the SQL dump' });
  const skipped = normalized.menus.length - routes.length;
  return { conversionId: `conv_${hash(`${input.platformId}:${input.sourceSystemId}:${sourceFingerprint}:${input.options.rulesVersion}`).slice(0, 20)}`, sourceFingerprint, status: issues.some((issue) => issue.severity === 'error') ? 'partial' : 'previewed', summary: { discovered: normalized.menus.length, created: routes.length, updated: 0, unchanged: 0, skipped, unresolved: issues.filter((issue) => issue.code === 'UNRESOLVED').length, conflicts: 0 }, routes, menuPatches, issues };
}
