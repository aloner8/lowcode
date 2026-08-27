// Core TypeScript Interfaces for Low-Code Platform Engine

export type ComponentType =
  | 'FieldInputComponent'
  | 'FormComponent'
  | 'TableDataComponent'
  | 'DataTableComponent'
  | 'ListComponent'
  | 'PostListComponent'
  | 'GalleryComponent'
  | 'FileManagerComponent'
  | 'FileManagerPopupComponent'
  | 'DynamicHtmlComponent'
  | 'HtmlEditorComponent'
  | 'HtmlTemplateComponent'
  | 'NavMenuComponent'
  | 'SlideMenuComponent'
  | 'EditMenuComponent'
  | 'CardComponent'
  | 'ChartComponent'
  | 'TabsContainerComponent'
  | 'AccordionComponent'
  | 'ModalDialogComponent'
  | 'SiteTopbarComponent'
  | 'SiteHeaderComponent'
  | 'SiteSidebarMenuComponent'
  | 'SiteFooterComponent'
  | 'HeroCarouselComponent'
  | 'ServiceLinksComponent'
  | 'StatCounterComponent'
  | 'PeopleGridComponent'
  | 'FloatingDockComponent'
  | 'SiteTickerComponent'
  | 'SiteSearchComponent'
  | 'ExecutiveCardComponent'
  | 'NoticeListComponent'
  | 'PartnerStripComponent'
  | 'MediaFeatureComponent'
  | 'CookieConsentComponent'
  | 'PagerComponent'
  | 'LanguageSwitchComponent'
  | 'FloatingNoticeComponent'
  | 'EventCalendarComponent'
  | 'VisitCounterComponent';

export type ThemePreset =
  | 'thai-municipal'
  | 'modern-indigo'
  | 'corporate-emerald'
  | 'dark-glassmorphism'
  | 'sunset-warm'
  | 'cyberpunk'
  | 'minimal-slate';

export interface ThemeConfig {
  preset: ThemePreset;
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor?: string;
  borderRadius: string; // e.g. "0.375rem"
  fontFamily: string;
  customVariables?: Record<string, string>;
}

/** CreatePlatform.MD §4 — decides which pages, modules and flows a blueprint gets. */
export type FirstPublicPageMode = 'PUBLIC_HOME' | 'PUBLIC_HOME_WITH_LOGIN' | 'LOGIN_PAGE';

export type PlatformModuleCode =
  | 'PAGES'
  | 'AUTH'
  | 'FLOW'
  | 'STYLE'
  | 'FORM'
  | 'SERVICE'
  | 'EVENT'
  | 'REPORT';

export interface PlatformModule {
  id: string;
  platformId: string;
  moduleCode: PlatformModuleCode;
  moduleName: string;
  moduleOrder: number;
  isEnabled: boolean;
  config: Record<string, any>;
}

export interface PlatformPage {
  id: string;
  platformId: string;
  pageSlug: string;
  title: string;
  accessLevel: 'PUBLIC' | 'PRIVATE';
  isEntryPage: boolean;
  componentTree: ComponentNode[];
  pageConfig: Record<string, any>;
}

export type PlatformFlowType = 'ENTERPRISE' | 'SEQUENCE' | 'APP_MANIFEST' | 'PAGE';

export interface PlatformWorkflow {
  id: string;
  platformId: string;
  flowCode: string;
  flowName: string;
  flowType: PlatformFlowType;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  config: Record<string, any>;
  updatedAt?: string;
}

export interface PlatformConfig {
  id: string; // UUID
  platformSlug: string; // e.g. "platform-erp"
  platformName: string; // e.g. "PlatformERP Solution"
  description?: string;
  category?: string; // e.g. "ERP", "CRM", "POS"
  categoryId?: string;
  firstPublicPage?: FirstPublicPageMode;
  masterThemeConfig: ThemeConfig;
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOverrides {
  disabledFeatures?: string[]; // IDs or ComponentTypes disabled for this tenant
  themeOverrides?: Partial<ThemeConfig>;
  componentPropsOverrides?: Record<string, { props?: Record<string, any>; style?: Record<string, any> }>;
}

export interface AppConfig {
  id: string; // UUID
  platformId?: string; // Parent Platform Blueprint ID
  platform?: PlatformConfig;
  appSlug: string; // e.g. "client-a"
  appName: string;
  description?: string;
  port: number; // e.g. 3001
  subdomain: string; // e.g. "app-a.mydomain.com"
  tenantDbName: string; // e.g. "app_db_client_a"
  themeConfig: ThemeConfig;
  tenantOverrides?: TenantOverrides;
  createdAt: string;
  updatedAt: string;
}

export interface StudioServiceDefinition {
  id: string;
  name: string;
  kind: 'auth';
  provider: 'jwt';
  scope: 'container';
  enabled: boolean;
  implementation: { owner: 'mother'; version: number; module: string };
  config: {
    algorithm: 'HS256';
    issuer: string;
    audience: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    secretEnvKey: string;
  };
  containerBindings: Array<{ containerName: string; enabled: boolean; configOverrides?: Partial<StudioServiceDefinition['config']> }>;
  bundle?: { status: 'not_provisioned' | 'ready'; loginPageId: string; adminPageId: string; userCollectionId: string; permissionCollectionId: string; roleCollectionId: string; flowPath: string };
}

export const createDefaultJwtAuthService = (platformSlug: string): StudioServiceDefinition => ({
  id: 'service.auth.jwt', name: 'Auth (JWT)', kind: 'auth', provider: 'jwt', scope: 'container', enabled: true,
  implementation: { owner: 'mother', version: 1, module: 'auth/jwt' },
  config: { algorithm: 'HS256', issuer: platformSlug, audience: `${platformSlug}-containers`, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800, secretEnvKey: 'PLATFORM_JWT_SECRET' },
  containerBindings: [],
  bundle: { status: 'not_provisioned', loginPageId: 'auth.login', adminPageId: 'auth.admin', userCollectionId: 'auth.user.collection', permissionCollectionId: 'auth.permission.collection', roleCollectionId: 'auth.role.collection', flowPath: '/login' },
});

export interface ComponentNode {
  id: string; // Immutable component instance ID within a page
  type: ComponentType;
  templateRef?: string; // Reusable component definition, e.g. component://CardComponent
  htmlId?: string; // Optional/stable DOM id for CSS, anchors, events and automation
  label?: string;
  props: Record<string, any>;
  style?: Record<string, any>;
  children?: ComponentNode[];
  actionTriggerId?: string; // Event bound to a workflow trigger
}

export interface PageLayout {
  id: string;
  appId: string;
  pageSlug: string; // e.g. "dashboard", "users", "home"
  title: string;
  isDefaultPage?: boolean;
  componentTree: ComponentNode[]; // Root component array
  createdAt: string;
  updatedAt: string;
}

export type WorkflowNodeType = 'trigger' | 'action' | 'condition';

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  actionType?: 'navigate' | 'apiCall' | 'dbMutation' | 'showAlert' | 'openModal';
  config?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: string; // e.g. 'customTriggerNode', 'customActionNode'
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionValue?: boolean | string;
}

export interface WorkflowTree {
  id: string;
  appId: string;
  flowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export type AuditLogEntityType = 'PLATFORM' | 'APP' | 'PAGE' | 'FLOW' | 'THEME' | 'USER' | 'DATABASE' | 'RUNTIME';

export type AuditLogAction =
  | 'CREATE_PLATFORM'
  | 'UPDATE_PLATFORM'
  | 'DELETE_PLATFORM'
  | 'CREATE_APP'
  | 'UPDATE_APP'
  | 'DELETE_APP'
  | 'UPDATE_PAGE'
  | 'UPDATE_THEME'
  | 'UPDATE_FLOW'
  | 'DELETE_PAGE'
  | 'PROVISION_MODULE'
  | 'PUBLISH_DATABASE'
  | 'BUILD_RUNTIME'
  | 'RECORD_INSERT'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'UPLOAD_ASSET'
  | 'DELETE_ASSET'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CHANGE_PASSWORD'
  | 'LOGIN';

export interface AuditLog {
  id: string;
  platformId?: string;
  platformName?: string;
  entityType: AuditLogEntityType;
  entityId?: string;
  action: AuditLogAction;
  performedBy: string;
  changesSummary: string;
  snapshotBefore?: Record<string, any>;
  snapshotAfter?: Record<string, any>;
  createdAt: string;
}

// ==========================================
// Authorisation — three tiers
// ==========================================
//
//   GOD    พนักงานหนุมานไอที — สร้าง Site ใหม่และตั้งค่าได้ทุก Site
//   ADMIN  ผู้ดูแลระบบของหน่วยงาน — เพิ่มผู้ใช้ ตั้งค่าเว็บของตัวเอง ดู package/วันหมดอายุ
//   STAFF  พนักงานของหน่วยงาน — เพิ่มข่าว (post) และแก้ไขหน้าเว็บ (page)
//
// GOD is global; ADMIN/STAFF/VIEWER are always scoped to one Site.

export type GlobalRole = 'GOD' | 'TENANT_USER';
export type SiteRole = 'ADMIN' | 'STAFF' | 'VIEWER';

/** Effective role on a given Site — GOD outranks every site membership. */
export type EffectiveRole = 'GOD' | SiteRole;

/** @deprecated ใช้ SiteRole แทน — คงไว้เพื่อความเข้ากันได้ */
export type AppRole = SiteRole;

export const ROLE_LABELS: Record<EffectiveRole, string> = {
  GOD: 'ผู้ให้บริการ (หนุมานไอที)',
  ADMIN: 'ผู้ดูแลระบบหน่วยงาน',
  STAFF: 'พนักงานหน่วยงาน',
  VIEWER: 'ผู้อ่านอย่างเดียว',
};

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  globalRole: GlobalRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SitePackage {
  code: string;
  name: string;
  startedAt: string;
  expiresAt: string | null;
  limits: { maxUsers?: number; maxStorageMb?: number; maxDomains?: number };
  isSuspended: boolean;
  suspendedReason?: string | null;
  /** Days until expiry; negative when already expired, null when perpetual. */
  daysRemaining: number | null;
}

export interface AppMembership {
  id: string;
  userId: string;
  appId: string;
  appRole: SiteRole;
  user?: UserProfile;
  app?: AppConfig;
  createdAt: string;
  updatedAt: string;
}

export type AppRouteTargetType = 'page' | 'form' | 'collection' | 'component' | 'service' | 'api' | 'start-point' | 'legacy' | 'external';

export interface AppRouteMigrationMetadata {
  sourceSystemId: string;
  sourceKey: string;
  sourceFingerprint: string;
  rulesVersion: string;
  managedFields: string[];
}

export interface AppRoute {
  id: string;
  platformId: string;
  containerName: string;
  path: string;
  label: string;
  targetType: AppRouteTargetType;
  targetId?: string;
  legacyPaths?: string[];
  externalUrl?: string;
  permission?: string;
  isPublic?: boolean;
  isDefault?: boolean;
  redirectToRouteId?: string;
  metadata?: Record<string, unknown> & { migration?: AppRouteMigrationMetadata };
}

export type RuntimeMenuAction =
  | { type: 'switchContent'; contentId: string; params?: Record<string, unknown>; refreshIntervalMs?: number }
  | { type: 'navigatePage'; pageId: string; params?: Record<string, unknown> }
  | { type: 'navigateRoute'; routeId: string; params?: Record<string, unknown> }
  | { type: 'openRoute'; routeId: string; params?: Record<string, unknown> }
  | { type: 'openExternal'; url: string; newTab?: boolean }
  | { type: 'runService'; serviceId: string; payload?: Record<string, unknown> }
  | { type: 'callApi'; apiId?: string; url?: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; payload?: Record<string, unknown>; resultContentId?: string }
  | { type: 'triggerAction'; actionId: string; payload?: Record<string, unknown> }
  | { type: 'none' };

// ==========================================
// Top-Level App WorkFlow (App Manifest) Types
// ==========================================

export type MenuActionType = 'OPEN_PAGE' | 'RUN_SERVICE' | 'TRIGGER_WORKFLOW';

export interface AppMenuAction {
  type: MenuActionType;
  targetPageSlug?: string; // For OPEN_PAGE
  serviceEndpoint?: string; // For RUN_SERVICE
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // For RUN_SERVICE
  workflowTreeId?: string; // For TRIGGER_WORKFLOW
  params?: Record<string, any>;
}

export interface AppMenuItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  roles?: string[];
  action: AppMenuAction;
  children?: AppMenuItem[];
}

export interface AppBootService {
  id: string;
  serviceName: string;
  type: 'AUTH_CHECK' | 'THEME_INJECT' | 'DB_CONNECT' | 'API_INIT';
  required: boolean;
  config?: Record<string, any>;
}

export interface AppWorkFlowManifest {
  appId: string;
  appSlug: string;
  appName: string;
  version: string;
  bootServices: AppBootService[];
  masterNavigation: AppMenuItem[];
  defaultPageSlug: string;
  updatedAt: string;
}

// ==========================================
// Enterprise Master Flow Engine Types
// ==========================================

export type EnterpriseNodeType =
  | 'start'
  | 'auth_check'
  | 'route_guard'
  | 'event_listener'
  | 'sub_flow'
  | 'close';

export type SubFlowCategory = 'page' | 'menu' | 'route' | 'action' | 'timer';

export interface SubFlowConfig {
  category: SubFlowCategory;
  triggerEvent: string;
  actionTarget: string;
  parameters?: Record<string, any>;
}

export interface EnterpriseFlowNodeData {
  label: string;
  nodeType: EnterpriseNodeType;
  category?: SubFlowCategory;
  triggerEvent?: string;
  actionTarget?: string;
  config?: Record<string, any>;
}

export interface EnterpriseWorkflowAST {
  appId: string;
  flowName: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: string;
}

// ==========================================
// Visual Sequence Diagram Studio Types
// ==========================================

export type LifelineParticipant = 'user' | 'browser' | 'api' | 'server' | 'db' | 'file';

export type SequenceMessageType = 'request' | 'response' | 'async' | 'decision';

export interface SequenceStepData {
  stepNumber: number;
  label: string;
  sourceLifeline: LifelineParticipant;
  targetLifeline: LifelineParticipant;
  messageType: SequenceMessageType;
  subFlowId?: string;
  config?: Record<string, any>;
}

// Tenant DB Schema Explorer Types
export interface DbColumnDefinition {
  columnName: string;
  dataType: 'varchar' | 'integer' | 'boolean' | 'timestamp' | 'uuid' | 'jsonb';
  isNullable: boolean;
  isPrimaryKey?: boolean;
}

export interface DbTableDefinition {
  tableName: string;
  columns: DbColumnDefinition[];
  rowCount?: number;
}

// ==========================================
// Tenant Data Access (Collection CRUD)
// ==========================================

export interface TenantRecordPage {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface TenantTableColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | null;
}

export interface TenantTableSchema {
  tableName: string;
  columns: TenantTableColumn[];
  rowCount: number;
}

export interface PlatformAsset {
  id: string;
  platformId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  checksum: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}
