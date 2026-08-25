// Core TypeScript Interfaces for Low-Code Platform Engine

export type ComponentType =
  | 'FieldInputComponent'
  | 'FormComponent'
  | 'TableDataComponent'
  | 'DataTableComponent'
  | 'ListComponent'
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
  | 'ModalDialogComponent';

export type ThemePreset =
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

export interface PlatformConfig {
  id: string; // UUID
  platformSlug: string; // e.g. "platform-erp"
  platformName: string; // e.g. "PlatformERP Solution"
  description?: string;
  category?: string; // e.g. "ERP", "CRM", "POS"
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

export interface AuditLog {
  id: string;
  appId: string;
  action: 'CREATE_APP' | 'UPDATE_PAGE' | 'UPDATE_THEME' | 'UPDATE_FLOW' | 'DELETE_PAGE';
  performedBy: string;
  changesSummary: string;
  snapshotBefore?: Record<string, any>;
  snapshotAfter?: Record<string, any>;
  createdAt: string;
}

// User & Auth Types for Platform Web แม่
export type GlobalRole = 'SUPER_ADMIN' | 'DEVELOPER' | 'VIEWER';
export type AppRole = 'APP_OWNER' | 'APP_EDITOR' | 'APP_VIEWER';

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppMembership {
  id: string;
  userId: string;
  appId: string;
  appRole: AppRole;
  user?: UserProfile;
  app?: AppConfig;
  createdAt: string;
  updatedAt: string;
}

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
