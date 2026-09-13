import {
  SCREEN_REGION_KEYS,
  TEMPLATE_DEFINITION_SCHEMA_VERSION,
  type CollectionDefinition,
  type JsonValue,
  type TemplateDefinition,
} from "./contracts";

export interface LegacyPlatformComponentNode {
  id: string;
  type: string;
  props?: Record<string, JsonValue> & { __platformComponentId?: string };
  style?: Record<string, JsonValue>;
  children?: LegacyPlatformComponentNode[];
  templateRef?: string;
  htmlId?: string;
  label?: string;
  actionTriggerId?: string;
}

export interface LegacyPlatformPage {
  id: string;
  name?: string;
  title?: string;
  componentTree?: LegacyPlatformComponentNode[];
}

export interface LegacyPlatformRoute {
  id: string;
  path: string;
  targetPageId: string;
  isDefault?: boolean;
}

export interface LegacyPlatformSnapshot {
  id: string;
  customerId: string;
  platformSlug: string;
  platformName: string;
  mainCss?: string;
  pages: LegacyPlatformPage[];
  routes: LegacyPlatformRoute[];
  collections?: CollectionDefinition[];
  reusableComponents?: Array<{
    id: string;
    name: string;
    componentType: "html" | "standard";
    version: number;
    definition: Record<string, JsonValue>;
  }>;
}

export interface LegacyAdapterIssue {
  code: string;
  message: string;
  sourcePath?: string;
}

export interface LegacyAdapterResult {
  definition: TemplateDefinition;
  issues: LegacyAdapterIssue[];
}

/**
 * P1 compatibility adapter for a controlled legacy snapshot. It deliberately
 * produces one Screen and reports ambiguity instead of guessing legacy Screen
 * boundaries. Production migration must persist and review those diagnostics.
 */
export function adaptLegacyPlatform(
  legacy: LegacyPlatformSnapshot,
): LegacyAdapterResult {
  if (!legacy.pages.length) {
    throw new Error("Legacy Platform must contain at least one Page");
  }

  const issues: LegacyAdapterIssue[] = [
    {
      code: "screen_boundary_inferred",
      message: "Legacy Platform has no Screen registry; all Pages were assigned to one generated Screen",
    },
  ];
  const pageIds = new Set(legacy.pages.map((page) => page.id));
  const reusableComponents = legacy.reusableComponents ?? [];
  const reusableIds = new Set(reusableComponents.map((component) => component.id));
  const screenId = `legacy-screen:${legacy.id}`;

  const validRoutes = legacy.routes.filter((route, index) => {
    if (pageIds.has(route.targetPageId)) {
      if (route.targetPageId !== legacy.pages[0].id) {
        issues.push({
          code: "route_page_target_not_preserved",
          sourcePath: `routes[${index}].targetPageId`,
          message: "Generated Screen opens the first Page, not this route's legacy Page; explicit Screen mapping is required",
        });
      }
      return true;
    }
    issues.push({
      code: "route_target_missing",
      message: `Route '${route.id}' references missing Page '${route.targetPageId}'`,
    });
    return false;
  });
  const routes = validRoutes.length
    ? validRoutes.map((route, index) => ({
        id: route.id,
        path: route.path,
        screenId,
        isDefault: route.isDefault ||
          (index === 0 && !validRoutes.some((candidate) => candidate.isDefault)),
      }))
    : [{ id: `legacy-route:${legacy.id}`, path: "/", screenId, isDefault: true }];

  const componentInstances = legacy.pages.flatMap((page, pageIndex) =>
    (page.componentTree ?? []).map((node, index) => {
      const sourcePath = `pages[${pageIndex}].componentTree[${index}]`;
      if (node.children?.length) {
        issues.push({
          code: "component_children_not_preserved",
          sourcePath: `${sourcePath}.children`,
          message: "Nested Components are not converted by the flat adapter; explicit layout mapping is required",
        });
      }
      for (const field of ["style", "templateRef", "htmlId", "label", "actionTriggerId"] as const) {
        if (node[field] !== undefined) {
          issues.push({
            code: "component_metadata_not_preserved",
            sourcePath: `${sourcePath}.${field}`,
            message: `Component ${field} is not mapped by this adapter; review the source snapshot before migration`,
          });
        }
      }
      const reusableId = node.props?.__platformComponentId;
      const props = { ...(node.props ?? {}) };
      delete props.__platformComponentId;
      if (reusableId && !reusableIds.has(reusableId)) {
        issues.push({
          code: "component_definition_missing",
          message: `Instance '${node.id}' references missing reusable Component '${reusableId}'`,
        });
      }
      const placement = {
        placement: "page_panel" as const,
        pageId: page.id,
        panelId: `legacy-panel:${page.id}`,
      };
      const base = {
        id: node.id,
        loadOrder: index,
        props,
        bindings: {},
        ...placement,
      };
      return reusableId && reusableIds.has(reusableId)
        ? { ...base, source: "reusable" as const, componentId: reusableId }
        : { ...base, source: "standard" as const, standardType: node.type };
    }),
  );

  return {
    issues,
    definition: {
      schemaVersion: TEMPLATE_DEFINITION_SCHEMA_VERSION,
      template: {
        id: `legacy-template:${legacy.id}`,
        customerId: legacy.customerId,
        name: legacy.platformName,
        status: "draft",
        editVersion: 1,
      },
      startup: {
        mainCss: legacy.mainCss ?? "",
        browserActions: [],
      },
      modules: [],
      routes,
      screens: [
        {
          id: screenId,
          name: `${legacy.platformName} Screen`,
          defaultPageId: legacy.pages[0].id,
          regions: SCREEN_REGION_KEYS.map((key) => ({
            key,
            componentInstanceIds: [],
          })),
          menu: legacy.pages.map((page) => ({
            id: `legacy-menu:${page.id}`,
            label: page.title ?? page.name ?? page.id,
            action: { type: "change_page" as const, pageId: page.id },
          })),
          popupIds: [],
          eventSteps: [],
          css: "",
        },
      ],
      screenPages: legacy.pages.map((page, index) => ({
        screenId,
        pageId: page.id,
        sortOrder: index,
      })),
      pages: legacy.pages.map((page) => ({
        id: page.id,
        name: page.title ?? page.name ?? page.id,
        panels: [
          {
            id: `legacy-panel:${page.id}`,
            name: "Legacy content",
            order: 0,
            responsive: { desktop: 12, tablet: 12, mobile: 12 },
          },
        ],
        collections: [],
        css: "",
      })),
      components: reusableComponents,
      componentInstances,
      collections: legacy.collections ?? [],
      popups: [],
    },
  };
}
