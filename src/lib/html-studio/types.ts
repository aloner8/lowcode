import type React from 'react';
import type { ComponentType } from '@/types';

export type StudioScope = 'platform' | 'app' | 'tenant';
export type StudioEnvironment = 'studio' | 'preview' | 'staging' | 'production';

export interface StableReference {
  id: string;
  scope: StudioScope;
  version?: string;
  displayName?: string;
}

export type StudioPrimitive = string | number | boolean | null;
export type StudioValue = StudioPrimitive | StudioPrimitive[] | Record<string, StudioPrimitive>;

export interface StudioNode {
  id: string;
  kind: 'element' | 'text' | 'component' | 'slot' | 'svg';
  tag?: string;
  text?: string;
  componentRef?: StableReference;
  attributes?: Record<string, StudioValue>;
  classList?: string[];
  children?: StudioNode[];
}

export interface StudioStyleRule {
  selector: string;
  declarations: Record<string, string>;
  breakpoint?: 'tablet' | 'mobile';
  state?: 'hover' | 'focus' | 'active' | 'disabled';
}

export interface StudioStyleSheet {
  scopeId: string;
  rules: StudioStyleRule[];
}

export interface TemplateDependency {
  kind: 'component' | 'asset' | 'collection' | 'page' | 'template';
  ref: string;
  version?: string;
}

export interface HtmlStudioDocument {
  id: string;
  scope: StudioScope;
  kind: 'page-template' | 'section' | 'shared-template' | 'svg-template';
  name: string;
  version: number;
  schemaVersion: 1;
  root: StudioNode[];
  styleSheet: StudioStyleSheet;
  dependencies: TemplateDependency[];
  settings: {
    cssScope: 'component' | 'page' | 'global';
    dataPolicy: 'mock-only' | 'collection-read';
    scriptPolicy: 'none';
  };
  createdAt: string;
  updatedAt: string;
}

export interface SharedComponentManifest {
  id: string;
  tagName: string;
  displayName: string;
  version: string;
  scope: StudioScope;
  rendererType: ComponentType;
  propsSchema: Record<string, unknown>;
  slots: Array<{ name: string; accepts: string[]; required?: boolean }>;
  events: Array<{ name: string; payloadSchema?: Record<string, unknown> }>;
  capabilities: Array<'collection-read' | 'navigate' | 'asset-read' | 'workflow-trigger'>;
}

export interface SiteMapEntry {
  id: string;
  pageId: string;
  slug: string;
  pathPattern: string;
  parentId?: string;
  localePaths?: Record<string, string>;
  requiredParams: string[];
  status: 'draft' | 'published' | 'disabled';
}

export interface AssetManifestEntry {
  id: string;
  scope: StudioScope;
  kind: 'image' | 'svg' | 'icon' | 'font' | 'video' | 'document';
  logicalName: string;
  mimeType: string;
  revision: string;
  variants: Record<string, { path: string; width?: number; height?: number }>;
  metadata: { width?: number; height?: number; alt?: string; tags?: string[] };
}

export interface CollectionManifest {
  id: string;
  name: string;
  scope: StudioScope;
  fields: Array<{ name: string; type: string; readable: boolean }>;
  publishedViews: string[];
}

export interface ResolveContext {
  environment: StudioEnvironment;
  platformId: string;
  appId: string;
  tenantId?: string;
  basePath: string;
  assetBaseUrl: string;
  locale: string;
  routeParams: Record<string, string>;
}

export interface HtmlStudioManifests {
  pages: SiteMapEntry[];
  assets: AssetManifestEntry[];
  components: SharedComponentManifest[];
  collections: CollectionManifest[];
}

export interface HtmlTemplateArtifact {
  templateId: string;
  revision: string;
  schemaVersion: 1;
  html: string;
  cssText: string;
  dependencies: TemplateDependency[];
  diagnostics: StudioDiagnostic[];
  compiledAt: string;
}

export interface StudioDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeId?: string;
}

export interface HtmlTemplateComponentProps {
  document?: HtmlStudioDocument;
  artifact?: HtmlTemplateArtifact;
  runtimeContext?: ResolveContext;
  manifests?: Partial<HtmlStudioManifests>;
  className?: string;
  componentRegistry?: Partial<Record<ComponentType, React.FC<Record<string, unknown>>>>;
}
