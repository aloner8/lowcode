export interface StudioPanel {
  id: string;
  name: string;
  order: number;
  responsive: { desktop: number; tablet: number; mobile: number };
}

export interface StudioPageRelation {
  pageObjectId: string;
  sortOrder: number;
  isDefault: boolean;
}

export interface StudioEventStep {
  id: string;
  phase: "onload" | "afterLoad" | "setLayout" | "afterSetLayout" | "changePage" | "afterChangePage";
  order: number;
  action: string;
  input?: Record<string, unknown>;
}

export type StudioComponentPlacement =
  | { placement: "page_panel"; pageId: string; panelId: string }
  | { placement: "screen_region"; screenId: string; region: string };

export interface StudioOrderedComponent {
  id: string;
  editVersion: number;
  objectKey: string;
  definition: Record<string, unknown>;
}

const width = (value: number) => Math.max(1, Math.min(12, Math.round(value)));

export const normalizePanels = (panels: StudioPanel[]): StudioPanel[] =>
  panels.map((panel, order) => ({
    ...panel,
    order,
    responsive: {
      desktop: width(panel.responsive.desktop),
      tablet: width(panel.responsive.tablet),
      mobile: width(panel.responsive.mobile),
    },
  }));

export const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const buildScreenPageUpdate = (
  orderedPageIds: string[],
  defaultPageId: string,
): StudioPageRelation[] => {
  if (!orderedPageIds.length) return [];
  const uniqueIds = [...new Set(orderedPageIds.filter(Boolean))];
  const actualDefault = uniqueIds.includes(defaultPageId) ? defaultPageId : uniqueIds[0];
  return uniqueIds.map((pageObjectId, sortOrder) => ({
    pageObjectId,
    sortOrder,
    isDefault: pageObjectId === actualDefault,
  }));
};

export const normalizeEventSteps = (steps: StudioEventStep[]): StudioEventStep[] =>
  steps.map((step, order) => ({ ...step, order }));

export const componentPlacementKey = (definition: Record<string, unknown>): string | null => {
  if (definition.placement === "page_panel") {
    const pageId = typeof definition.pageId === "string" ? definition.pageId : "";
    const panelId = typeof definition.panelId === "string" ? definition.panelId : "";
    return pageId && panelId ? `page_panel:${pageId}:${panelId}` : null;
  }
  if (definition.placement === "screen_region") {
    const screenId = typeof definition.screenId === "string" ? definition.screenId : "";
    const region = typeof definition.region === "string" ? definition.region : "";
    return screenId && region ? `screen_region:${screenId}:${region}` : null;
  }
  return null;
};

export const placementOf = (
  definition: Record<string, unknown>,
): StudioComponentPlacement | null => {
  if (definition.placement === "page_panel") {
    const pageId = typeof definition.pageId === "string" ? definition.pageId : "";
    const panelId = typeof definition.panelId === "string" ? definition.panelId : "";
    return pageId && panelId ? { placement: "page_panel", pageId, panelId } : null;
  }
  if (definition.placement === "screen_region") {
    const screenId = typeof definition.screenId === "string" ? definition.screenId : "";
    const region = typeof definition.region === "string" ? definition.region : "";
    return screenId && region ? { placement: "screen_region", screenId, region } : null;
  }
  return null;
};

export const orderComponents = <T extends StudioOrderedComponent>(items: T[]): T[] =>
  [...items].sort((left, right) => {
    const loadOrder = Number(left.definition.loadOrder ?? 0) - Number(right.definition.loadOrder ?? 0);
    return loadOrder || left.objectKey.localeCompare(right.objectKey);
  });

/** Converts a property input without silently turning booleans/numbers into strings. */
export const parseStudioValue = (value: string): string | number | boolean | null => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
};

export const renameRecordKey = (
  source: Record<string, unknown>,
  oldKey: string,
  newKey: string,
): Record<string, unknown> => {
  const normalized = newKey.trim();
  if (!normalized || (normalized !== oldKey && normalized in source)) return source;
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key === oldKey ? normalized : key, value]),
  );
};
