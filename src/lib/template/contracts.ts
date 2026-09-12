/**
 * Foundation contract for the Customer -> Template -> App model described in
 * ImplementPlan.MD. These types intentionally describe definitions, not the
 * physical PostgreSQL schema. P1 migrations may map more than one legacy table
 * to a single object below.
 */

export const TEMPLATE_DEFINITION_SCHEMA_VERSION = "1.0.0" as const;

export type TemplateDefinitionSchemaVersion =
  typeof TEMPLATE_DEFINITION_SCHEMA_VERSION;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type TemplatePublicationStatus = "draft" | "published";

export interface TemplateIdentity {
  id: string;
  customerId: string;
  name: string;
  status: TemplatePublicationStatus;
  editVersion: number;
  /** Present only for an immutable published snapshot. */
  revision?: string;
}

export interface TemplateStartupDefinition {
  /** Server-side reference. The referenced connection secret is never exported. */
  connectionProfileRef?: string;
  mainCss: string;
  browserActions: Array<{
    id: string;
    action: string;
    input?: Record<string, JsonValue>;
  }>;
}

export interface TemplateModuleDefinition {
  id: string;
  moduleKey: string;
  enabled: boolean;
  config: Record<string, JsonValue>;
}

export interface TemplateRouteDefinition {
  id: string;
  path: string;
  screenId: string;
  isDefault?: boolean;
}

export const SCREEN_REGION_KEYS = [
  "header",
  "left",
  "content",
  "right",
  "footer",
] as const;

export type ScreenRegionKey = (typeof SCREEN_REGION_KEYS)[number];

export type ScreenEventPhase =
  | "onload"
  | "afterLoad"
  | "setLayout"
  | "afterSetLayout"
  | "changePage"
  | "afterChangePage";

export interface ScreenEventStepDefinition {
  id: string;
  phase: ScreenEventPhase;
  order: number;
  action: string;
  input?: Record<string, JsonValue>;
}

export type MenuActionDefinition =
  | {
      type: "change_page";
      pageId: string;
      params?: Record<string, JsonValue>;
    }
  | {
      type: "navigate_route";
      routeId: string;
      params?: Record<string, JsonValue>;
    }
  | {
      type: "open_popup";
      popupId: string;
      params?: Record<string, JsonValue>;
    };

export interface ScreenDefinition {
  id: string;
  name: string;
  defaultPageId: string;
  regions: Array<{
    key: ScreenRegionKey;
    componentInstanceIds: string[];
  }>;
  menu: Array<{
    id: string;
    label: string;
    action: MenuActionDefinition;
  }>;
  popupIds: string[];
  eventSteps: ScreenEventStepDefinition[];
  css: string;
}

/** Authoritative many-to-many relationship between screens and pages. */
export interface ScreenPageDefinition {
  screenId: string;
  pageId: string;
  sortOrder: number;
}

export interface PagePanelDefinition {
  id: string;
  name: string;
  order: number;
  responsive: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
}

export interface PageCollectionLoadDefinition {
  collectionId: string;
  loadOrder: number;
  alias: string;
  query?: Record<string, JsonValue>;
}

export interface PageDefinition {
  id: string;
  name: string;
  panels: PagePanelDefinition[];
  collections: PageCollectionLoadDefinition[];
  css: string;
}

export interface ReusableComponentDefinition {
  id: string;
  name: string;
  componentType: "html" | "standard";
  version: number;
  definition: Record<string, JsonValue>;
}

interface ComponentInstanceBase {
  id: string;
  loadOrder: number;
  props: Record<string, JsonValue>;
  bindings: Record<string, string>;
}

type ComponentInstanceSource =
  | { source: "standard"; standardType: string }
  | { source: "reusable"; componentId: string };

type ComponentInstancePlacement =
  | {
      placement: "screen_region";
      screenId: string;
      region: ScreenRegionKey;
    }
  | {
      placement: "page_panel";
      pageId: string;
      panelId: string;
    };

export type AppComponentInstanceDefinition = ComponentInstanceBase &
  ComponentInstanceSource &
  ComponentInstancePlacement;

export type CollectionFieldType =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "json";

export interface CollectionFieldDefinition {
  id: string;
  name: string;
  type: CollectionFieldType;
  required: boolean;
  primaryKey?: boolean;
  defaultValue?: JsonValue;
  references?: {
    collectionId: string;
    fieldId: string;
  };
}

export interface CollectionDefinition {
  id: string;
  name: string;
  tableName: string;
  fields: CollectionFieldDefinition[];
}

export interface PopupDefinition {
  id: string;
  pageId: string;
}

export interface TemplateDefinition {
  schemaVersion: TemplateDefinitionSchemaVersion;
  template: TemplateIdentity;
  startup: TemplateStartupDefinition;
  modules: TemplateModuleDefinition[];
  routes: TemplateRouteDefinition[];
  screens: ScreenDefinition[];
  screenPages: ScreenPageDefinition[];
  pages: PageDefinition[];
  components: ReusableComponentDefinition[];
  componentInstances: AppComponentInstanceDefinition[];
  collections: CollectionDefinition[];
  popups: PopupDefinition[];
}

export type LifecyclePhase =
  | "app_startup"
  | "screen_onload"
  | "screen_load_complete"
  | "screen_after_load"
  | "screen_set_layout"
  | "screen_set_layout_complete"
  | "screen_after_set_layout"
  | "screen_change_page"
  | "page_onload"
  | "page_collection_load"
  | "page_onload_complete"
  | "page_component_prepare"
  | "page_components_complete"
  | "screen_component_prepare"
  | "page_ready"
  | "screen_change_page_complete"
  | "screen_after_change_page";

export interface RuntimeRequestToken {
  requestId: string;
  screenInstanceId: string;
  targetPageInstanceId?: string;
  cancelled: boolean;
}

export interface ScreenRuntimeContext {
  appId: string;
  templateRevision: string;
  routeId: string;
  screenId: string;
  screenInstanceId: string;
  currentPageId?: string;
  desiredPageId?: string;
  params: Record<string, JsonValue>;
  data: Record<string, JsonValue>;
  memory: Record<string, JsonValue>;
  token: RuntimeRequestToken;
}

export interface PageRuntimeContext {
  pageId: string;
  pageInstanceId: string;
  params: Record<string, JsonValue>;
  data: Record<string, JsonValue>;
  memory: Record<string, JsonValue>;
  token: RuntimeRequestToken;
}
