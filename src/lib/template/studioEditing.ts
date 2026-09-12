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
