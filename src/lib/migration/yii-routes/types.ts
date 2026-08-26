import type { AppRoute } from '@/types';

export interface YiiSourceMenu {
  sourceKey: string; id: string; parentId?: string; label: string; href: string; icon?: string; location?: string;
}
export interface YiiNormalizedSource { menus: YiiSourceMenu[]; metadata: Record<string, unknown>; }
export interface RouteMappingOverride { sourceKey: string; path?: string; targetType?: AppRoute['targetType']; targetId?: string; containerName?: string; }
export interface YiiRouteConversionInput {
  platformId: string; sourceSystemId: string; sqlText: string;
  options: { mode: 'dry-run' | 'apply'; targetContainers: { frontend: string; backend: string }; rulesVersion: string; preserveLegacyHref?: boolean; overwriteManualChanges?: boolean };
  mappingOverrides?: RouteMappingOverride[];
}
export interface MenuConversionPatch { sourceKey: string; menuId: string; legacyHref: string; routeId: string; action: { type: 'openRoute'; routeId: string }; }
export interface ConversionIssue { severity: 'warning' | 'error'; code: string; sourceKey?: string; message: string; }
export interface YiiRouteConversionResult {
  conversionId: string; sourceFingerprint: string; status: 'previewed' | 'applied' | 'partial' | 'failed';
  summary: { discovered: number; created: number; updated: number; unchanged: number; skipped: number; unresolved: number; conflicts: number };
  routes: AppRoute[]; menuPatches: MenuConversionPatch[]; issues: ConversionIssue[];
}
