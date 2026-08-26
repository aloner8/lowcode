import type { AppRoute } from '@/types';

export interface SiteMapRouteNode {
  id: string; segment: string; path: string; label: string; routeId?: string;
  targetType?: AppRoute['targetType']; targetId?: string; legacyPaths?: string[];
  children: SiteMapRouteNode[];
}
export interface SiteMapContainer { containerName: string; routeCount: number; roots: SiteMapRouteNode[]; }
export interface GeneratedSiteMap { version: 1; generatedAt: string; routeCount: number; containers: SiteMapContainer[]; issues: Array<{ code: string; routeId: string; message: string }>; }

const normalizePath = (path: string) => path === '/' ? '/' : `/${path.split('/').filter(Boolean).join('/')}`;

export function generateSiteMap(routes: AppRoute[]): GeneratedSiteMap {
  const byContainer = new Map<string, AppRoute[]>();
  const issues: GeneratedSiteMap['issues'] = [];
  for (const route of routes) {
    if (!route.id || !route.containerName || !route.path) { issues.push({ code: 'INVALID_ROUTE', routeId: route.id || 'unknown', message: 'Route requires id, containerName and path' }); continue; }
    (byContainer.get(route.containerName) || (byContainer.set(route.containerName, []), byContainer.get(route.containerName)!)).push({ ...route, path: normalizePath(route.path) });
  }
  const containers = Array.from(byContainer.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([containerName, containerRoutes]) => {
    const roots: SiteMapRouteNode[] = []; const nodeByPath = new Map<string, SiteMapRouteNode>();
    const ensureNode = (path: string, segment: string) => {
      const existing = nodeByPath.get(path); if (existing) return existing;
      const node: SiteMapRouteNode = { id: `path:${containerName}:${path}`, segment, path, label: segment === '/' ? 'Home' : segment, children: [] };
      nodeByPath.set(path, node);
      const parentPath = path === '/' || path.split('/').filter(Boolean).length === 1 ? null : `/${path.split('/').filter(Boolean).slice(0, -1).join('/')}`;
      if (parentPath) ensureNode(parentPath, parentPath.split('/').filter(Boolean).at(-1)!).children.push(node); else roots.push(node);
      return node;
    };
    for (const route of [...containerRoutes].sort((a, b) => a.path.localeCompare(b.path))) {
      const segment = route.path === '/' ? '/' : route.path.split('/').filter(Boolean).at(-1)!;
      const node = ensureNode(route.path, segment);
      Object.assign(node, { id: route.id, routeId: route.id, label: route.label, targetType: route.targetType, targetId: route.targetId, legacyPaths: route.legacyPaths });
    }
    return { containerName, routeCount: containerRoutes.length, roots };
  });
  return { version: 1, generatedAt: new Date().toISOString(), routeCount: containers.reduce((sum, item) => sum + item.routeCount, 0), containers, issues };
}
