'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppConfig, AppRoute, ComponentNode, StudioServiceDefinition } from '@/types';
import { COMPONENT_PALETTE, ComponentPaletteItem } from '@/lib/engine/ComponentRegistry';
import {
  Folder,
  FileText,
  Database,
  Table,
  ChevronDown,
  ChevronRight,
  Layers,
  MapPin,
  Workflow,
  Puzzle,
  Box,
  Server,
  Plus,
  Search,
  ExternalLink,
  Sparkles,
  Compass,
  Zap,
  Braces,
  Link2,
  X,
  Image as ImageIcon,
  Files,
  Video,
  Shapes,
  Type,
  Cloud,
  HardDriveDownload,
  Play,
  Grid3X3,
  Terminal,
  Clock3,
  Settings,
  PlugZap,
  Wrench,
  Download,
  Upload,
  Trash2,
  KeyRound,
  ArrowRight,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import type { StudioCollectionDefinition, StudioFormDefinition } from '@/lib/studio/backendFormDefinitions';

interface StudioTreeviewOutlineProps {
  appInfo: AppConfig;
  platformId: string | null;
  activePage: string;
  setActivePage: (page: string) => void;
  onAddComponent: (item: ComponentPaletteItem) => void;
  pages: Array<{ id: string; name: string; containerName?: string; routePath?: string; isDefaultPage?: boolean; siteMapMaterialized?: boolean; componentTree?: ComponentNode[] }>;
  routes?: AppRoute[];
  services: StudioServiceDefinition[];
  forms: StudioFormDefinition[];
  activeFormId: string | null;
  onSelectForm: (formId: string, mode: 'insert' | 'update' | 'readOnly') => void;
  onAddCollectionForm: (collectionId: string) => void;
  collections: StudioCollectionDefinition[];
  activeCollectionViewId: string | null;
  onSelectCollectionView: (collectionId: string, viewId: string, variant?: string) => void;
  onAddCollectionComponent: (collectionId: string, sourceComponentId: string) => void;
  onGenerateAppComponentFromImage: () => void;
  onSelectPageComponent: (pageId: string, nodeId: string) => void;
  onOpenPageSettings: (pageId: string) => void;
  onSelectPageFlow: (route: { path: string; label: string; type: 'public_page' | 'form_crud' }) => void;
  onSelectRawTable: (tableName: string) => void;
  onOpenPageManager: (containerName?: string) => void;
  onOpenSiteMapNodeManager: (containerName?: string) => void;
  onProvisionAuthBundle: () => Promise<void>;
  onRoutesChanged?: (routes: AppRoute[]) => void;
  onSelectSiteMapNode?: (routeId: string) => void;
  onDeleteSiteMapNode?: (route: AppRoute) => Promise<void>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface ComponentDataCollection {
  id: string;
  pageId: string;
  pageName: string;
  sectionId: string;
  sectionName: string;
  componentId: string;
  componentType: string;
  componentLabel: string;
  dataSource?: unknown;
  listSource?: unknown;
}

interface ComponentAssetUsage {
  id: string;
  assetId: string;
  pageId: string;
  pageName: string;
  componentId: string;
  componentType: string;
  property: string;
}

interface PlatformComponentInstance {
  id: string;
  pageId: string;
  pageName: string;
  node: ComponentNode;
  displayName: string;
}

type QueryResultTab = 'table' | 'json' | 'log';
type DatabaseSettingPage = 'connection' | 'api' | 'tools';
type ConnectionProfileStatus = 'DRAFT' | 'READY' | 'DISABLED' | 'ERROR';
interface PublicConnectionProfile {
  id: string;
  profileKey: string;
  profileName: string;
  profileType: 'POSTGRES' | 'HTTP' | 'OBJECT_STORAGE';
  config: Record<string, unknown>;
  policy: { allowedModuleKeys: string[]; allowRuntimeWrite: boolean };
  status: ConnectionProfileStatus;
  editVersion: number;
  secretReferences: Array<{ key: string; provider: string; configured: boolean }>;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
}

const COLLECTION_COMPONENT_VARIANTS: Record<string, string[]> = {
  DataTableComponent: ['default', 'compact', 'selectable'],
  ListComponent: ['default', 'loading', 'empty'],
  GalleryComponent: ['grid', 'masonry', 'carousel'],
  DynamicHtmlComponent: ['preview', 'full', 'print'],
  DocumentComponent: ['screen', 'print', 'pdf'],
};

const collectionComponentGroup = (component: StudioCollectionDefinition['components'][number]) => component.label === 'Document' ? 'DocumentComponent' : component.type;
const collectionComponentLabel: Record<string, string> = { DataTableComponent: 'Data Tables', ListComponent: 'Lists', GalleryComponent: 'Galleries', DynamicHtmlComponent: 'View Details', DocumentComponent: 'Documents' };

export const StudioTreeviewOutline: React.FC<StudioTreeviewOutlineProps> = ({
  appInfo,
  platformId,
  activePage,
  setActivePage,
  onAddComponent,
  pages,
  routes = [],
  services,
  forms,
  activeFormId,
  onSelectForm,
  onAddCollectionForm,
  collections,
  activeCollectionViewId,
  onSelectCollectionView,
  onAddCollectionComponent,
  onGenerateAppComponentFromImage,
  onSelectPageComponent,
  onOpenPageSettings,
  onSelectPageFlow,
  onSelectRawTable,
  onOpenPageManager,
  onOpenSiteMapNodeManager,
  onProvisionAuthBundle,
  onRoutesChanged,
  onSelectSiteMapNode,
  onDeleteSiteMapNode,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openPageSections, setOpenPageSections] = useState<Record<string, boolean>>({});
  const [formsOpen, setFormsOpen] = useState(true);
  const [openFormModules, setOpenFormModules] = useState<Record<string, boolean>>({ cms: true });
  const [rootCollectionsOpen, setRootCollectionsOpen] = useState(true);
  const [openRootCollections, setOpenRootCollections] = useState<Record<string, boolean>>({});
  const [openCollectionForms, setOpenCollectionForms] = useState<Record<string, boolean>>({});
  const [openFormInstances, setOpenFormInstances] = useState<Record<string, boolean>>({});
  const [openCollectionComponentTypes, setOpenCollectionComponentTypes] = useState<Record<string, boolean>>({});
  const [openCollectionComponentInstances, setOpenCollectionComponentInstances] = useState<Record<string, boolean>>({});
  const [openSiteContainers, setOpenSiteContainers] = useState<Record<string, boolean>>({});
  const [openSiteRoutes, _setOpenSiteRoutes] = useState<Record<string, boolean>>({ '/': true });
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [openResourceGroups, setOpenResourceGroups] = useState<Record<string, boolean>>({ pages: true, components: false, services: false });
  const [openRouteGroups, setOpenRouteGroups] = useState<Record<string, boolean>>({ '/:events': true, '/:pages': true });
  const [routeFlows, setRouteFlows] = useState<Array<{ routePath: string; nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }> }>>([]);
  const [showAutoTools, setShowAutoTools] = useState(false);
  const [yiiSqlText, setYiiSqlText] = useState('');
  const [yiiSourceSystemId, setYiiSourceSystemId] = useState('yii-project');
  const [autoToolStatus, setAutoToolStatus] = useState<string | null>(null);
  const [autoToolError, setAutoToolError] = useState<string | null>(null);
  const [autoToolBusy, setAutoToolBusy] = useState(false);
  const [conversionPreview, setConversionPreview] = useState<{ sourceFingerprint: string; summary: { discovered: number; created: number; skipped: number; unresolved: number; conflicts: number } } | null>(null);
  const [autoSourceMode, setAutoSourceMode] = useState<'sql' | 'collection'>('sql');
  const [selectedAutoCollectionIds, setSelectedAutoCollectionIds] = useState<string[]>([]);
  const [collectionRoutePreview, setCollectionRoutePreview] = useState<{ selected: number; created: number; updated: number; unchanged: number } | null>(null);
  const [autoTargetContainer, setAutoTargetContainer] = useState(`${appInfo.appSlug}-backend`);
  const autoContainerOptions = useMemo(() => Array.from(new Set([`${appInfo.appSlug}-frontend`, `${appInfo.appSlug}-backend`, ...routes.map((route) => route.containerName).filter(Boolean)])), [appInfo.appSlug, routes]);
  useEffect(() => { setAutoTargetContainer((current) => autoContainerOptions.includes(current) ? current : `${appInfo.appSlug}-backend`); }, [appInfo.appSlug, autoContainerOptions]);
  useEffect(() => {
    if (!platformId) return;
    fetch(`/api/platforms/${platformId}/page-flows`, { cache: 'no-store' }).then((response) => response.json()).then((data: { flows?: Array<{ routePath: string; nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }> }> }) => setRouteFlows(data.flows || [])).catch(() => setRouteFlows([]));
  }, [platformId]);
  const [tenantDatabaseOpen, setTenantDatabaseOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [openCollectionPages, setOpenCollectionPages] = useState<Record<string, boolean>>({});
  const [selectedCollection, setSelectedCollection] = useState<ComponentDataCollection | null>(null);
  const [selectedAssetCategory, setSelectedAssetCategory] = useState<string | null>(null);
  const [selectedRawTable, setSelectedRawTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResultTab, setQueryResultTab] = useState<QueryResultTab>('table');
  const [queryRunAt, setQueryRunAt] = useState<Date | null>(null);
  const [queryRows, setQueryRows] = useState<unknown[][]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  const [queryDurationMs, setQueryDurationMs] = useState<number | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [databaseSettingPage, setDatabaseSettingPage] = useState<DatabaseSettingPage | null>(null);
  const [openDatabaseGroups, setOpenDatabaseGroups] = useState<Record<string, boolean>>({ raw: true, collections: true, procedures: true, functions: true });
  const formsByModule = useMemo(() => forms.reduce<Record<string, StudioFormDefinition[]>>((result, form) => { (result[form.moduleId] ||= []).push(form); return result; }, {}), [forms]);
  const collectionsByModule = useMemo(() => collections.reduce<Record<string, StudioCollectionDefinition[]>>((result, collection) => { (result[collection.moduleId] ||= []).push(collection); return result; }, {}), [collections]);

  // Expandable state for treeview outline sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    appWorkflow: true,
    solutionExplorer: true,
    assets: true,
    siteMapFlow: true,
    basicComponents: true,
    appComponents: true,
    serviceAssign: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const siteRoutes: Array<{ path: string; label: string; type: 'public_page' | 'form_crud' }> = [
    { path: '/', label: 'Home Page (Index)', type: 'public_page' },
    { path: '/services', label: 'Services Catalogue', type: 'public_page' },
    { path: '/contact', label: 'Contact Us Form', type: 'form_crud' },
  ];
  const platformSiteRoutes = useMemo<Array<{ id?: string; path: string; label: string; type: 'public_page' | 'form_crud'; nodeType: AppRoute['targetType']; isStartPoint: boolean; outlinePath: Array<{ id: string; label: string }>; page: StudioTreeviewOutlineProps['pages'][number] & { containerName: string } }>>(() => {
    if (routes.length) {
      const generated = routes.map((route) => {
      const linkedPage = route.targetType === 'page' && route.targetId ? pages.find((page) => page.id === route.targetId) : undefined;
      const page = linkedPage || { id: route.targetId || route.id, name: route.label, containerName: route.containerName, routePath: route.path, componentTree: [] };
      const storedOutline = Array.isArray(route.metadata?.outlinePath) ? route.metadata.outlinePath : [];
      const inferredModule = route.legacyPaths?.[0]?.split('?')[0].split('/').filter(Boolean)[0];
      const outlinePath = storedOutline.length ? storedOutline : (inferredModule ? [{ id: `module:${inferredModule}`, label: inferredModule.toUpperCase() }] : []);
      return { id: route.id, path: route.path, label: route.label, type: (route.targetType === 'form' ? 'form_crud' : 'public_page') as 'public_page' | 'form_crud', nodeType: route.targetType, isStartPoint: Boolean(route.isDefault || route.metadata?.isStartPoint), outlinePath, page: { ...page, containerName: route.containerName } };
      });
      const linkedPageIds = new Set(routes.filter((route) => route.targetType === 'page' && route.targetId).map((route) => route.targetId));
      const unlinkedPages = pages.filter((page) => !linkedPageIds.has(page.id) && !page.siteMapMaterialized).map((page) => {
        const pageName = page.name || page.id;
        const inferredSurface = /admin|backend/i.test(`${page.id} ${pageName}`) ? 'backend' : 'frontend';
        const containerName = page.containerName?.trim() || `${appInfo.appSlug}-${inferredSurface}`;
        return { id: `route.page.${page.id}`, path: page.routePath || (page.isDefaultPage ? '/' : `/${page.id}`), label: pageName.replace(/\s*\([^)]*\)\s*$/, '') || page.id, type: 'public_page' as const, nodeType: 'page' as const, isStartPoint: Boolean(page.isDefaultPage), outlinePath: [], page: { ...page, name: pageName, containerName } };
      });
      return [...generated, ...unlinkedPages];
    }
    if (pages.some((page) => page.siteMapMaterialized)) return [];
    const seenContainers = new Set<string>();
    return pages.map((page) => {
      const pageName = page.name || page.id;
      const inferredSurface = /admin|backend/i.test(`${page.id} ${pageName}`) ? 'backend' : 'frontend';
      const containerName = page.containerName?.trim() || `${appInfo.appSlug}-${inferredSurface}`;
      const isFirstInContainer = !seenContainers.has(containerName);
      seenContainers.add(containerName);
      return { path: page.routePath || (page.isDefaultPage || isFirstInContainer ? '/' : `/${page.id}`), label: pageName.replace(/\s*\([^)]*\)\s*$/, '') || page.id, type: 'public_page' as const, nodeType: 'page' as const, isStartPoint: Boolean(page.isDefaultPage || isFirstInContainer), outlinePath: [], page: { ...page, name: pageName, containerName } };
    });
  }, [appInfo.appSlug, pages, routes]);
  const siteRoutesByContainer = useMemo(() => platformSiteRoutes.reduce<Record<string, typeof platformSiteRoutes>>((result, route) => {
    const inferredSurface = /admin|backend/i.test(`${route.page.id} ${route.page.name}`) ? 'backend' : 'frontend';
    const containerName = route.page.containerName?.trim() || `${appInfo.appSlug}-${inferredSurface}`;
    (result[containerName] ||= []).push(route);
    return result;
  }, {}), [appInfo.appSlug, platformSiteRoutes]);

  const basicItems = COMPONENT_PALETTE.filter(
    (item) => item.category === 'Form Controls' || item.type === 'DynamicHtmlComponent'
  ).filter((i) => i.label.toLowerCase().includes(searchTerm.toLowerCase()));

  const appItems = COMPONENT_PALETTE.filter(
    (item) => item.category !== 'Form Controls' && item.type !== 'DynamicHtmlComponent'
  ).filter((i) => i.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const appItemsByCategory = useMemo(() => appItems.reduce<Record<string, ComponentPaletteItem[]>>((result, item) => {
    (result[item.category] ||= []).push(item);
    return result;
  }, {}), [appItems]);
  const [openAppCategories, setOpenAppCategories] = useState<Record<string, boolean>>({ Navigation: true, 'Data Display': true, 'Media & Files': true, Layout: true });
  const [openAppTypes, setOpenAppTypes] = useState<Record<string, boolean>>({});

  const componentInventoryByType = useMemo(() => {
    const inventory: Record<string, PlatformComponentInstance[]> = {};
    const visit = (page: StudioTreeviewOutlineProps['pages'][number], node: ComponentNode) => {
      (inventory[node.type] ||= []).push({
        id: `${page.id}:${node.id}`,
        pageId: page.id,
        pageName: page.name,
        node,
        displayName: String(node.label || node.props?.title || node.props?.brandName || node.props?.label || node.type),
      });
      node.children?.forEach((child) => visit(page, child));
    };
    pages.forEach((page) => page.componentTree?.forEach((node) => visit(page, node)));
    return inventory;
  }, [pages]);
  const unboundResourcePages = useMemo(() => {
    const linked = new Set(routes.filter((route) => route.targetType === 'page' && route.targetId).map((route) => route.targetId));
    return pages.filter((page) => !linked.has(page.id));
  }, [pages, routes]);
  const componentResources = useMemo(() => Object.values(componentInventoryByType).flat(), [componentInventoryByType]);
  const serviceResources = useMemo(() => services, [services]);

  const setStudioDragData = (event: React.DragEvent, payload: Record<string, unknown>) => {
    event.dataTransfer.effectAllowed = 'copy';
    const serialized = JSON.stringify(payload);
    event.dataTransfer.setData('application/x-lowcode-studio-item', serialized);
    event.dataTransfer.setData('text/plain', serialized);
  };

  const dataCollections = useMemo<ComponentDataCollection[]>(() => {
    const result: ComponentDataCollection[] = [];
    const visit = (page: StudioTreeviewOutlineProps['pages'][number], node: ComponentNode) => {
      const dataSource = node.props?.dataSource;
      const listSource = node.props?.listSource;
      if (dataSource !== undefined || listSource !== undefined) {
        result.push({
          id: `${page.id}:${node.id}`,
          pageId: page.id,
          pageName: page.name,
          sectionId: String(node.props?.__sectionId || 'main'),
          sectionName: String(node.props?.__sectionName || 'Main Section'),
          componentId: node.id,
          componentType: node.type,
          componentLabel: String(node.props?.title || node.props?.brandName || node.type),
          dataSource,
          listSource,
        });
      }
      node.children?.forEach((child) => visit(page, child));
    };
    pages.forEach((page) => page.componentTree?.forEach((node) => visit(page, node)));
    return result;
  }, [pages]);

  const collectionsByPage = useMemo(() => dataCollections.reduce<Record<string, ComponentDataCollection[]>>((result, collection) => {
    (result[collection.pageId] ||= []).push(collection);
    return result;
  }, {}), [dataCollections]);

  const assetUsages = useMemo<ComponentAssetUsage[]>(() => {
    const result: ComponentAssetUsage[] = [];
    const visit = (page: StudioTreeviewOutlineProps['pages'][number], node: ComponentNode) => {
      Object.entries(node.props || {}).forEach(([property, value]) => {
        if (/assetId$/i.test(property) && typeof value === 'string' && value.trim()) {
          result.push({ id: `${page.id}:${node.id}:${property}`, assetId: value, pageId: page.id, pageName: page.name, componentId: node.id, componentType: node.type, property });
        }
      });
      node.children?.forEach((child) => visit(page, child));
    };
    pages.forEach((page) => page.componentTree?.forEach((node) => visit(page, node)));
    return result;
  }, [pages]);

  const assetCategories = [
    { id: 'images', label: 'Images', icon: ImageIcon, color: 'text-primary' },
    { id: 'documents', label: 'Documents', icon: Files, color: 'text-danger' },
    { id: 'videos', label: 'Videos', icon: Video, color: 'text-info' },
    { id: 'icons', label: 'Icons', icon: Shapes, color: 'text-warning' },
    { id: 'fonts', label: 'Fonts', icon: Type, color: 'text-success' },
    { id: 'external', label: 'External Media', icon: Cloud, color: 'text-secondary' },
  ];

  const rawTables = useMemo(() => {
    const names = new Set<string>(['users']);
    dataCollections.forEach((collection) => {
      const source = collection.dataSource as { table?: unknown; tables?: unknown } | undefined;
      if (typeof source?.table === 'string') names.add(source.table);
      if (Array.isArray(source?.tables)) source.tables.forEach((table) => { if (typeof table === 'string') names.add(table); });
    });
    return Array.from(names).sort();
  }, [dataCollections]);

  const databaseFunctions = ['fn_menu_tree', 'fn_published_posts', 'fn_procurement_feed', 'fn_active_slides', 'fn_site_search'];
  const databaseProcedures = ['sp_increment_site_visit', 'sp_submit_complaint'];
  const databaseSettings = [
    { id: 'connection' as const, label: 'Connection Profile', icon: PlugZap },
    { id: 'api' as const, label: 'API', icon: Braces },
    { id: 'tools' as const, label: 'Tools', icon: Wrench },
  ];
  const [connectionProfiles, setConnectionProfiles] = useState<PublicConnectionProfile[]>([]);
  const [activeConnectionProfile, setActiveConnectionProfile] = useState<PublicConnectionProfile | null>(null);
  const [selectedConnectionProfileId, setSelectedConnectionProfileId] = useState<string>('');
  const [connectionProfileStatus, setConnectionProfileStatus] = useState<string | null>(null);
  const [connectionProfileError, setConnectionProfileError] = useState<string | null>(null);
  const [connectionProfileBusy, setConnectionProfileBusy] = useState(false);
  const [showConnectionProfileCreate, setShowConnectionProfileCreate] = useState(false);
  const [editingConnectionProfile, setEditingConnectionProfile] = useState<PublicConnectionProfile | null>(null);
  const [connectionProfileDraft, setConnectionProfileDraft] = useState({
    profileKey: 'main.app',
    profileName: 'App PostgreSQL',
    host: 'db.internal',
    port: 5432,
    database: appInfo.tenantDbName,
    sslMode: 'require',
    poolMax: 8,
    usernameRef: 'env://LOWCODE_CONNECTION_APP_DB_USER',
    passwordRef: 'env://LOWCODE_CONNECTION_APP_DB_PASSWORD',
    allowedModuleKeys: 'data.collection,reports',
    allowRuntimeWrite: false,
  });
  useEffect(() => {
    setConnectionProfileDraft((current) => current.database === appInfo.tenantDbName
      ? current
      : { ...current, database: appInfo.tenantDbName });
  }, [appInfo.tenantDbName]);

  const loadConnectionProfiles = async () => {
    if (!appInfo.id) return;
    setConnectionProfileBusy(true);
    setConnectionProfileError(null);
    try {
      const response = await fetch(`/api/apps/${appInfo.id}/connection-profile`, { cache: 'no-store' });
      const data = await response.json() as { connectionProfile?: PublicConnectionProfile | null; profiles?: PublicConnectionProfile[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load Connection Profiles');
      const profiles = data.profiles || [];
      setConnectionProfiles(profiles);
      setActiveConnectionProfile(data.connectionProfile || null);
      setSelectedConnectionProfileId(data.connectionProfile?.id || '');
      setConnectionProfileStatus(profiles.length ? 'Connection Profiles loaded' : 'ยังไม่มี Connection Profile สำหรับ App นี้');
    } catch (error) {
      setConnectionProfiles([]);
      setActiveConnectionProfile(null);
      setSelectedConnectionProfileId('');
      setConnectionProfileError(error instanceof Error ? error.message : 'Unable to load Connection Profiles');
      setConnectionProfileStatus(null);
    } finally {
      setConnectionProfileBusy(false);
    }
  };

  useEffect(() => {
    if (databaseSettingPage !== 'connection') return;
    void loadConnectionProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseSettingPage, appInfo.id]);

  const bindConnectionProfile = async (nextProfileId = selectedConnectionProfileId) => {
    setConnectionProfileBusy(true);
    setConnectionProfileError(null);
    try {
      const profileId = nextProfileId || null;
      const response = await fetch(`/api/apps/${appInfo.id}/connection-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          expectedConnectionProfileId: activeConnectionProfile?.id || null,
        }),
      });
      const data = await response.json() as { connectionProfile?: PublicConnectionProfile | null; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to update App Connection Profile');
      setActiveConnectionProfile(data.connectionProfile || null);
      setSelectedConnectionProfileId(data.connectionProfile?.id || '');
      setConnectionProfileStatus(data.connectionProfile ? 'ตั้ง Connection Profile ให้ App แล้ว' : 'ถอด Connection Profile ออกจาก App แล้ว');
      await loadConnectionProfiles();
    } catch (error) {
      setConnectionProfileError(error instanceof Error ? error.message : 'Unable to update App Connection Profile');
    } finally {
      setConnectionProfileBusy(false);
    }
  };

  const validateConnectionProfile = async (profileId: string) => {
    setConnectionProfileBusy(true);
    setConnectionProfileError(null);
    try {
      const response = await fetch(`/api/connection-profiles/${profileId}/validate`, { method: 'POST' });
      const data = await response.json() as { valid?: boolean; errors?: string[]; profile?: PublicConnectionProfile; error?: string };
      if (!response.ok) throw new Error(data.errors?.join('; ') || data.error || 'Connection Profile validation failed');
      setConnectionProfileStatus(data.valid ? 'ตรวจ Connection Profile ผ่านแล้ว' : 'Connection Profile ยังไม่พร้อม');
      await loadConnectionProfiles();
    } catch (error) {
      setConnectionProfileError(error instanceof Error ? error.message : 'Connection Profile validation failed');
    } finally {
      setConnectionProfileBusy(false);
    }
  };

  const createConnectionProfile = async () => {
    setConnectionProfileBusy(true);
    setConnectionProfileError(null);
    try {
      const allowedModuleKeys = connectionProfileDraft.allowedModuleKeys
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      const config = {
        host: connectionProfileDraft.host,
        port: Number(connectionProfileDraft.port),
        database: connectionProfileDraft.database,
        sslMode: connectionProfileDraft.sslMode,
        poolMax: Number(connectionProfileDraft.poolMax),
      };
      const policy = {
        allowedModuleKeys,
        allowRuntimeWrite: connectionProfileDraft.allowRuntimeWrite,
      };
      const response = await fetch(editingConnectionProfile ? `/api/connection-profiles/${editingConnectionProfile.id}` : `/api/apps/${appInfo.id}/connection-profile`, {
        method: editingConnectionProfile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConnectionProfile ? {
          expectedEditVersion: editingConnectionProfile.editVersion,
          profileName: connectionProfileDraft.profileName,
          config,
          policy,
        } : {
          profileKey: connectionProfileDraft.profileKey,
          profileName: connectionProfileDraft.profileName,
          profileType: 'POSTGRES',
          config,
          secretRefs: {
            username: connectionProfileDraft.usernameRef,
            password: connectionProfileDraft.passwordRef,
          },
          policy,
        }),
      });
      const data = await response.json() as { profile?: PublicConnectionProfile; errors?: string[]; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.errors?.join('; ') || data.error || (editingConnectionProfile ? 'Unable to update Connection Profile' : 'Unable to create Connection Profile'));
      setShowConnectionProfileCreate(false);
      setEditingConnectionProfile(null);
      setSelectedConnectionProfileId(data.profile.id);
      setConnectionProfileStatus(editingConnectionProfile ? 'บันทึก Connection Profile แล้ว' : 'สร้าง Connection Profile แล้ว เลือก Apply เพื่อผูกกับ App');
      await loadConnectionProfiles();
      setSelectedConnectionProfileId(data.profile.id);
    } catch (error) {
      setConnectionProfileError(error instanceof Error ? error.message : (editingConnectionProfile ? 'Unable to update Connection Profile' : 'Unable to create Connection Profile'));
    } finally {
      setConnectionProfileBusy(false);
    }
  };

  const startEditingConnectionProfile = (profile: PublicConnectionProfile) => {
    setEditingConnectionProfile(profile);
    setShowConnectionProfileCreate(true);
    setConnectionProfileError(null);
    setConnectionProfileDraft((current) => ({
      ...current,
      profileKey: profile.profileKey,
      profileName: profile.profileName,
      host: String(profile.config.host ?? current.host),
      port: Number(profile.config.port ?? current.port),
      database: String(profile.config.database ?? current.database),
      sslMode: String(profile.config.sslMode ?? current.sslMode),
      poolMax: Number(profile.config.poolMax ?? current.poolMax),
      allowedModuleKeys: profile.policy.allowedModuleKeys.join(','),
      allowRuntimeWrite: profile.policy.allowRuntimeWrite,
    }));
  };

  const openRawTableDetail = (tableName: string) => {
    onSelectRawTable(tableName);
  };

  const runRawTableQuery = async () => {
    if (!platformId) return setQueryError('ไม่พบ platformId สำหรับเชื่อมต่อ Tenant Database');
    setIsQueryRunning(true);
    setQueryError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/database/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: sqlQuery }),
      });
      const data = (await response.json()) as { columns?: string[]; rows?: unknown[][]; durationMs?: number; executedAt?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Query failed');
      setQueryColumns(data.columns || []);
      setQueryRows(data.rows || []);
      setQueryDurationMs(data.durationMs ?? null);
      setQueryRunAt(data.executedAt ? new Date(data.executedAt) : new Date());
    } catch (error) {
      setQueryRows([]);
      setQueryColumns([]);
      setQueryDurationMs(null);
      setQueryRunAt(new Date());
      setQueryError(error instanceof Error ? error.message : 'Query failed');
      setQueryResultTab('log');
    } finally {
      setIsQueryRunning(false);
    }
  };

  const MenuAddButton = ({ label, onClick }: { label: string; onClick?: () => void }) => <button
    type="button"
    className="btn btn-sm border-0 rounded-1 d-inline-flex align-items-center gap-1 px-1.5 py-0 text-primary bg-white bg-opacity-75"
    style={{ fontSize: '0.62rem', minHeight: 20 }}
    title={`Add ${label}`}
    aria-label={`Add ${label}`}
    onClick={(event) => { event.stopPropagation(); onClick?.(); }}
  ><Plus size={11} /><span className="d-none d-xl-inline">Add</span></button>;

  const previewYiiSiteMap = async () => {
    if (!platformId || !yiiSqlText.trim()) return setAutoToolError('กรุณาเลือกไฟล์ Yii SQL dump ก่อน');
    setAutoToolBusy(true); setAutoToolError(null); setAutoToolStatus('กำลังวิเคราะห์ Yii routes...'); setConversionPreview(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/route-conversions/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSystemId: yiiSourceSystemId.trim() || 'yii-project', sqlText: yiiSqlText, options: { rulesVersion: 'yii2-react-route-v1', targetContainers: { frontend: autoTargetContainer, backend: autoTargetContainer }, preserveLegacyHref: true } }) });
      const data = await response.json() as { conversion?: typeof conversionPreview; error?: string };
      if (!response.ok || !data.conversion) throw new Error(data.error || 'Preview failed');
      setConversionPreview(data.conversion); setAutoToolStatus('Preview พร้อมตรวจสอบแล้ว');
    } catch (error) { setAutoToolError(error instanceof Error ? error.message : 'Preview failed'); setAutoToolStatus(null); }
    finally { setAutoToolBusy(false); }
  };

  const applyYiiSiteMap = async () => {
    if (!platformId || !conversionPreview) return;
    setAutoToolBusy(true); setAutoToolError(null); setAutoToolStatus('กำลังสร้าง Routes และ Site Map...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/route-conversions/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSystemId: yiiSourceSystemId.trim() || 'yii-project', sqlText: yiiSqlText, previewFingerprint: conversionPreview.sourceFingerprint, options: { rulesVersion: 'yii2-react-route-v1', targetContainers: { frontend: autoTargetContainer, backend: autoTargetContainer }, preserveLegacyHref: true } }) });
      const data = await response.json() as { conversion?: { summary: typeof conversionPreview.summary }; error?: string };
      if (!response.ok) throw new Error(data.error || 'Apply failed');
      const studioResponse = await fetch(`/api/platforms/${platformId}/studio?t=${Date.now()}`, { cache: 'no-store' });
      const studioData = await studioResponse.json() as { platform?: { studioRoutes?: AppRoute[] } };
      onRoutesChanged?.(studioData.platform?.studioRoutes || []);
      setAutoToolStatus(`สร้าง Site Map สำเร็จ: ${data.conversion?.summary.created || 0} routes ใหม่`);
    } catch (error) { setAutoToolError(error instanceof Error ? error.message : 'Apply failed'); setAutoToolStatus(null); }
    finally { setAutoToolBusy(false); }
  };

  const recheckYiiTargets = async () => {
    if (!platformId) return setAutoToolError('ไม่พบ Platform สำหรับตรวจสอบ Yii');
    setAutoToolBusy(true); setAutoToolError(null); setAutoToolStatus('กำลังค้นหา Yii views และ forms ตาม Route...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/route-conversions/recheck-yii`, { method: 'POST' });
      const data = await response.json() as { routes?: AppRoute[]; summary?: { checked: number; matched: number; unresolved: number; formsAdded: number; collectionsAdded: number }; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || 'ReCheckYII failed');
      onRoutesChanged?.(data.routes || []);
      setAutoToolStatus(`ReCheckYII สำเร็จ: ผูก ${data.summary.matched}/${data.summary.checked} routes, เพิ่ม ${data.summary.formsAdded} forms และ ${data.summary.collectionsAdded} collections, ยังไม่พบ ${data.summary.unresolved}`);
    } catch (error) { setAutoToolError(error instanceof Error ? error.message : 'ReCheckYII failed'); setAutoToolStatus(null); }
    finally { setAutoToolBusy(false); }
  };

  const runCollectionSiteMap = async (apply: boolean) => {
    if (!platformId || !selectedAutoCollectionIds.length) return setAutoToolError('กรุณาเลือก Collection อย่างน้อยหนึ่งรายการ');
    setAutoToolBusy(true); setAutoToolError(null); setAutoToolStatus(apply ? 'กำลังสร้าง Routes จาก Collections...' : 'กำลัง Preview Collections...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/site-map/from-collections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collectionIds: selectedAutoCollectionIds, containerName: autoTargetContainer, apply }) });
      const data = await response.json() as { summary?: typeof collectionRoutePreview; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || 'Collection route generation failed');
      setCollectionRoutePreview(data.summary); setAutoToolStatus(apply ? `สร้าง Site Map จาก ${data.summary.selected} Collections สำเร็จ` : 'Preview พร้อมตรวจสอบแล้ว');
      if (apply) { const studioResponse = await fetch(`/api/platforms/${platformId}/studio?t=${Date.now()}`, { cache: 'no-store' }); const studioData = await studioResponse.json() as { platform?: { studioRoutes?: AppRoute[] } }; onRoutesChanged?.(studioData.platform?.studioRoutes || []); }
    } catch (error) { setAutoToolError(error instanceof Error ? error.message : 'Collection route generation failed'); setAutoToolStatus(null); }
    finally { setAutoToolBusy(false); }
  };

  if (collapsed) return <div className="card shadow-sm border-0 rounded-3 bg-white h-100 d-flex align-items-center pt-2">
    <button type="button" className="btn btn-sm btn-outline-primary border-0" onClick={onToggleCollapsed} title="Expand DevStudio Explorer"><PanelLeftOpen size={19}/></button>
    <div className="text-primary fw-bold mt-2" style={{ writingMode: 'vertical-rl', fontSize: '.68rem', letterSpacing: '.08em' }}>เครื่องมือออกแบบ</div>
  </div>;

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100 d-flex flex-column select-none">
      {/* DevStudio Treeview Header */}
      <div className="card-header bg-light border-bottom py-2.5 px-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-1.5">
          <Layers size={16} className="text-primary" />
          <h6 className="fw-bold mb-0 text-dark extra-small text-uppercase" style={{ letterSpacing: '0.04em' }}>
            DevStudio Explorer
          </h6>
        </div>
        <span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.62rem' }}>
          Treeview Outline
        </span>
        <button type="button" className="btn btn-sm btn-outline-primary border-0 p-1" onClick={onToggleCollapsed} title="Collapse DevStudio Explorer"><PanelLeftClose size={16}/></button>
      </div>

      {/* Search Input Filter */}
      <div className="p-2 border-bottom bg-white">
        <div className="position-relative">
          <Search size={12} className="position-absolute text-muted" style={{ left: '9px', top: '8px' }} />
          <input
            type="text"
            className="form-control form-control-sm bg-light ps-4 text-dark border-0 rounded-2 extra-small"
            placeholder="Search treeview outline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Main Treeview Accordion List */}
      <div className="card-body p-2 overflow-auto flex-grow-1" style={{ maxHeight: 'calc(100vh - 220px)', fontSize: '0.78rem' }}>

        {/* Site Map is the navigation root. Page Layouts exist only as route resources. */}
        <div className="mb-2">
          <div className="d-flex align-items-center justify-content-between px-2 py-1.5 rounded-2 bg-primary bg-opacity-10 text-primary fw-bold border border-primary border-opacity-25">
            <div className="d-flex align-items-center gap-2"><MapPin size={16}/><span>ผังเว็บไซต์</span></div><div className="d-flex align-items-center gap-1"><button type="button" className="btn btn-sm border-0 rounded-1 d-inline-flex align-items-center gap-1 px-2 py-0 text-warning bg-white" style={{ fontSize: '.62rem', minHeight: 20 }} onClick={() => setShowAutoTools(true)} title="Site Map Auto Tools"><Sparkles size={12}/><span className="d-none d-xl-inline">Auto</span></button><MenuAddButton label="site route" onClick={() => onOpenSiteMapNodeManager()}/><span className="adm-chip is-info">หลัก</span></div>
          </div>
          <div className="ms-2 ps-2 border-start mt-1">{Object.entries(siteRoutesByContainer).map(([containerName, containerRoutes]) => { const containerOpen = openSiteContainers[containerName] !== false; return <div key={containerName} className="mb-1">
            <div className="d-flex align-items-center bg-light rounded-1"><button type="button" className="btn btn-sm border-0 flex-grow-1 d-flex align-items-center gap-1 text-start px-1 py-1 text-dark fw-bold" onClick={() => setOpenSiteContainers((current) => ({ ...current, [containerName]: !containerOpen }))}>{containerOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}<Box size={12} className="text-primary"/><span className="text-truncate">{containerName}</span><span className="badge bg-primary bg-opacity-10 text-primary ms-auto">{containerRoutes.length} Routes</span></button><MenuAddButton label={`route to ${containerName}`} onClick={() => onOpenSiteMapNodeManager(containerName)}/></div>
            {containerOpen && <div className="ms-3 ps-2 border-start">{containerRoutes.map((route, routeIndex) => { const routeKey = `${containerName}:${route.path}`; const storedRoute = routes.find((item) => item.id === route.id); const serviceDefinition = route.nodeType === 'service' ? services.find((service) => service.id === storedRoute?.targetId) : undefined; const serviceFlowPath = serviceDefinition?.bundle?.flowPath; const _serviceFlow = serviceFlowPath ? routeFlows.find((flow) => flow.routePath === serviceFlowPath) : undefined; const servicePages = serviceDefinition?.bundle ? [serviceDefinition.bundle.loginPageId, serviceDefinition.bundle.adminPageId].map((id) => pages.find((page) => page.id === id)).filter((page): page is StudioTreeviewOutlineProps['pages'][number] => Boolean(page)) : []; const flowRoutePath = serviceFlowPath || routeKey; const routeOpen = openSiteRoutes[routeKey] === true; const group = (name: string) => `${routeKey}:${name}`; const outlinePath = route.outlinePath || []; const previousOutline = routeIndex > 0 ? (containerRoutes[routeIndex - 1].outlinePath || []) : []; const newOutline = outlinePath.filter((item, depth) => previousOutline[depth]?.id !== item.id); return <React.Fragment key={routeKey}>{newOutline.map((item) => { const depth = outlinePath.findIndex((entry) => entry.id === item.id); return <div key={`${routeKey}:outline:${item.id}`} className="d-flex align-items-center gap-1 py-1 text-primary fw-bold" style={{ marginLeft: depth * 14, fontSize: '.68rem' }}><ChevronDown size={10}/><Folder size={11} className="text-warning fill-warning"/><span className="text-truncate">{item.label}</span></div>; })}<div className="mb-1" style={{ marginLeft: outlinePath.length * 14 }}>
            <div className="d-flex align-items-center w-100 overflow-hidden gap-1"><button type="button" className="btn btn-sm border-0 d-flex align-items-center gap-1 text-start px-1 py-1 text-dark fw-semibold overflow-hidden" style={{ minWidth: 0 }} onClick={() => route.id && onSelectSiteMapNode?.(route.id)}>{route.nodeType === 'page' ? <FileText size={12} className="text-primary flex-shrink-0"/> : route.nodeType === 'form' ? <Files size={12} className="text-success flex-shrink-0"/> : route.nodeType === 'collection' ? <Database size={12} className="text-warning flex-shrink-0"/> : route.nodeType === 'external' ? <ExternalLink size={12} className="text-info flex-shrink-0"/> : <Compass size={12} className="text-danger flex-shrink-0"/>}<span className="text-truncate">{route.label}</span></button><button type="button" className="btn btn-sm btn-danger p-1 flex-shrink-0 d-inline-flex align-items-center justify-content-center" style={{ width: 22, height: 22 }} title={`Delete ${route.label}`} aria-label={`Delete ${route.label}`} disabled={!route.id} onClick={(event) => { event.stopPropagation(); if (route.id && window.confirm(`ลบ Node '${route.label}' (${route.path}) ใช่หรือไม่?`)) void onDeleteSiteMapNode?.({ id: route.id, platformId: platformId || '', containerName, path: route.path, label: route.label, targetType: route.nodeType }); }}><Trash2 size={12}/></button><span className="badge bg-light text-secondary text-uppercase flex-shrink-0" style={{ fontSize: '.48rem' }}>{route.nodeType}</span>{route.isStartPoint && <span className="badge bg-warning text-dark flex-shrink-0" style={{ fontSize: '.45rem' }}>START</span>}<code className="ms-auto text-truncate" style={{ fontSize: '.58rem', maxWidth: 72 }}>{route.path}</code></div>
            {serviceDefinition?.bundle && <div className="ms-3 ps-2 border-start py-1">
              {servicePages.map((page, index) => <React.Fragment key={page.id}>
                <button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-start text-secondary py-1 px-1" style={{ fontSize: '.62rem' }} onClick={() => setActivePage(page.id)}><FileText size={10} className={index === 0 ? 'text-primary' : 'text-success'}/><span className="text-truncate">{index === 0 ? 'Login Page' : 'Admin Page'} · {page.name}</span><span className="badge bg-light text-secondary ms-auto">PAGE</span></button>
                {index === 1 && <div className="ms-2 ps-2 border-start"><button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-start text-danger py-1 px-1" style={{ fontSize: '.61rem' }} onClick={() => setActivePage(page.id)}><LogOut size={10}/>Logout Button<span className="badge bg-light text-danger ms-auto">LINK BUTTON</span></button></div>}
              </React.Fragment>)}
            </div>}
            {false && routeOpen && <div className="ms-3 ps-2 border-start">
              <div><div className="d-flex align-items-center justify-content-between py-1"><button className="btn btn-sm border-0 p-0 d-flex align-items-center gap-1 text-warning fw-semibold" style={{ fontSize: '.65rem' }} onClick={() => setOpenRouteGroups((current) => ({ ...current, [group('events')]: current[group('events')] === false }))}>{openRouteGroups[group('events')] !== false ? <ChevronDown size={9}/> : <ChevronRight size={9}/>}<Zap size={10}/> Events</button><MenuAddButton label="event flow" onClick={() => onSelectPageFlow({ path: flowRoutePath, label: `${containerName} / ${route.label}`, type: route.type })}/></div>
                {openRouteGroups[group('events')] !== false && <div className="ms-3 ps-2 border-start"><button type="button" className="btn btn-sm border-0 w-100 text-start text-secondary py-1 px-1" style={{ fontSize: '.62rem' }} onClick={() => onSelectPageFlow({ path: flowRoutePath, label: `${containerName} / ${route.label}`, type: route.type })}><Workflow size={9} className="me-1 text-warning"/>OnLoad → OpenPage({route.page.id})</button></div>}
              </div>
              <div><div className="d-flex align-items-center justify-content-between py-1"><button className="btn btn-sm border-0 p-0 d-flex align-items-center gap-1 text-primary fw-semibold" style={{ fontSize: '.65rem' }} onClick={() => setOpenRouteGroups((current) => ({ ...current, [group('pages')]: current[group('pages')] === false }))}>{openRouteGroups[group('pages')] !== false ? <ChevronDown size={9}/> : <ChevronRight size={9}/>}<FileText size={10}/> Pages</button><MenuAddButton label="page" onClick={() => onOpenPageManager(containerName)}/></div>
                {openRouteGroups[group('pages')] !== false && <div className="ms-3 ps-2 border-start">{(() => {
                  const page = route.page;
                  const pageKey = `${routeKey}:page:${page.id}`;
                  const pageOpen = openPageSections[pageKey] !== false;
                  const grouped = (page.componentTree || []).reduce<Record<string, { name: string; nodes: ComponentNode[] }>>((result, node) => {
                    const id = String(node.props?.__sectionId || 'main');
                    if (!result[id]) result[id] = { name: String(node.props?.__sectionName || 'Main Section'), nodes: [] };
                    result[id].nodes.push(node);
                    return result;
                  }, {});
                  return <div>
                    <div className={`d-flex align-items-center rounded-1 ${activePage === page.id ? 'bg-primary text-white fw-semibold' : 'text-secondary'}`}>
                      <button type="button" className={`btn btn-sm border-0 flex-grow-1 text-start py-1 px-1 ${activePage === page.id ? 'text-white' : 'text-secondary'}`} style={{ fontSize: '.62rem' }} onClick={() => { setActivePage(page.id); setOpenPageSections((current) => ({ ...current, [pageKey]: !pageOpen })); }}>
                        {pageOpen ? <ChevronDown size={9} className="me-1"/> : <ChevronRight size={9} className="me-1"/>}<FileText size={9} className="me-1"/>{page.name}
                      </button>
                      <button type="button" className={`btn btn-sm border-0 p-1 ${activePage === page.id ? 'text-white' : 'text-secondary'}`} title={`Page settings: ${page.name}`} onClick={(event) => { event.stopPropagation(); onOpenPageSettings(page.id); }}><Settings size={11}/></button>
                    </div>
                    {pageOpen && <div className="ms-2 ps-2 border-start">{Object.entries(grouped).map(([sectionId, section]) => {
                      const sectionKey = `${pageKey}:section:${sectionId}`;
                      const sectionOpen = openPageSections[sectionKey] !== false;
                      return <div key={sectionKey}>
                        <button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-dark py-1 px-0 fw-semibold" style={{ fontSize: '.61rem' }} onClick={() => setOpenPageSections((current) => ({ ...current, [sectionKey]: !sectionOpen }))}>
                          {sectionOpen ? <ChevronDown size={9}/> : <ChevronRight size={9}/>}<Layers size={10} className="text-warning"/><span className="text-truncate">{section.name}</span><span className="badge bg-light text-secondary ms-auto">{section.nodes.length}</span>
                        </button>
                        {sectionOpen && <div className="ms-3">{section.nodes.map((node) => <button key={node.id} type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-secondary text-start py-1 px-0" style={{ fontSize: '.6rem' }} onClick={() => onSelectPageComponent(page.id, node.id)} title={`Open ${node.type} in Component Workshop`}><Box size={9} className="text-success"/><span className="text-truncate">{String(node.props?.title || node.props?.brandName || node.label || node.type)}</span></button>)}</div>}
                      </div>;
                    })}{Object.keys(grouped).length === 0 && <div className="text-muted py-1" style={{ fontSize: '.58rem' }}>No sections yet</div>}</div>}
                  </div>;
                })()}</div>}
              </div>
              {(['services','apis'] as const).map((kind) => { const flowNodes = (routeFlows.find((flow) => flow.routePath === flowRoutePath)?.nodes || []).filter((node) => kind === 'services' ? String(node.data?.actionType || '').toLowerCase().includes('service') : String(node.data?.actionType || '').toLowerCase().includes('api')); return <div key={kind}><div className="d-flex align-items-center justify-content-between py-1"><button className="btn btn-sm border-0 p-0 d-flex align-items-center gap-1 text-info fw-semibold text-capitalize" style={{ fontSize: '.65rem' }} onClick={() => setOpenRouteGroups((current) => ({ ...current, [group(kind)]: current[group(kind)] === false }))}>{openRouteGroups[group(kind)] !== false ? <ChevronDown size={9}/> : <ChevronRight size={9}/>} {kind === 'services' ? <Server size={10}/> : <PlugZap size={10}/>} {kind} <span className="badge bg-light text-info">{flowNodes.length}</span></button><MenuAddButton label={kind === 'services' ? 'service binding' : 'API call'} onClick={() => onSelectPageFlow({ path: flowRoutePath, label: `${containerName} / ${route.label}`, type: route.type })}/></div>{openRouteGroups[group(kind)] !== false && <div className="ms-3 ps-2 border-start text-muted py-1" style={{ fontSize: '.6rem' }}>{flowNodes.length ? flowNodes.map((node) => <div key={node.id} className="py-1"><Zap size={8} className="me-1"/>{String(node.data?.label || node.id)}</div>) : `No ${kind} assigned`}</div>}</div>; })}
            </div>}
          </div></React.Fragment>; })}</div>}
          </div>; })}</div>
        </div>

        {showAutoTools && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2060, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(3px)' }} onClick={() => !autoToolBusy && setShowAutoTools(false)}>
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(94vw,720px)' }} onClick={(event) => event.stopPropagation()}>
            <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between p-3"><div className="d-flex align-items-center gap-2"><Sparkles size={20} className="text-warning"/><div><b>Site Map Auto Tools</b><div className="text-white-50" style={{ fontSize: '.68rem' }}>คำสั่งอัตโนมัติที่เรียกซ้ำได้สำหรับ Platform</div></div></div><button className="btn btn-sm btn-outline-light border-0" onClick={() => setShowAutoTools(false)} disabled={autoToolBusy}><X size={17}/></button></div>
            <div className="card-body p-4">
              <div className="border rounded-3 p-3 mb-3 bg-light"><div className="d-flex align-items-start gap-2 mb-3"><Sparkles size={18} className="text-primary mt-1"/><div><b>Auto Site Map</b><div className="text-secondary small">สร้าง Route ID และ Site Map จาก Yii หรือ Collections ที่มีจริงใน Project</div></div></div>
                <div className="btn-group btn-group-sm mb-3"><button className={`btn ${autoSourceMode === 'sql' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAutoSourceMode('sql')}>Yii SQL dump</button><button className={`btn ${autoSourceMode === 'collection' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAutoSourceMode('collection')}>Project Collections</button></div>
                <div className="mb-3"><label className="form-label small mb-1">Target Container</label><select className="form-select form-select-sm" value={autoTargetContainer} onChange={(event) => { setAutoTargetContainer(event.target.value); setConversionPreview(null); setCollectionRoutePreview(null); }} disabled={autoToolBusy}>{autoContainerOptions.map((containerName) => <option key={containerName} value={containerName}>{containerName}</option>)}</select><small className="text-muted">Routes ที่สร้างทั้งหมดจะถูกบันทึกใน container นี้</small></div>
                {autoSourceMode === 'sql' ? <div className="row g-2"><div className="col-md-5"><label className="form-label small mb-1">Source System ID</label><input className="form-control form-control-sm" value={yiiSourceSystemId} onChange={(event) => { setYiiSourceSystemId(event.target.value); setConversionPreview(null); }} placeholder="เช่น yang-obt" disabled={autoToolBusy}/></div><div className="col-md-7"><label className="form-label small mb-1">Yii SQL dump</label><input type="file" accept=".sql,text/plain" className="form-control form-control-sm" disabled={autoToolBusy} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setYiiSourceSystemId((current) => current === 'yii-project' ? file.name.replace(/\.sql$/i, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase() : current); setConversionPreview(null); setAutoToolStatus(`เลือก ${file.name}`); setAutoToolError(null); void file.text().then(setYiiSqlText).catch(() => setAutoToolError('ไม่สามารถอ่านไฟล์ SQL ได้')); }}/></div></div> : <div><label className="form-label small mb-1">Collections ใน Project ({collections.length})</label><select multiple className="form-select form-select-sm" style={{ minHeight: 180 }} value={selectedAutoCollectionIds} onChange={(event) => { setSelectedAutoCollectionIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value)); setCollectionRoutePreview(null); }}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.moduleId} / {collection.name} ({collection.table})</option>)}</select><div className="d-flex justify-content-between mt-1"><small className="text-muted">กด Ctrl/⌘ เพื่อเลือกหลายรายการ</small><button className="btn btn-link btn-sm p-0" onClick={() => setSelectedAutoCollectionIds(collections.map((item) => item.id))}>เลือกทั้งหมด</button></div></div>}
                {conversionPreview && <div className="alert alert-primary py-2 mt-3 mb-0 small"><b>Preview:</b> พบ {conversionPreview.summary.discovered} เมนู · สร้าง {conversionPreview.summary.created} routes · ข้าม {conversionPreview.summary.skipped} หัวข้อ · unresolved {conversionPreview.summary.unresolved} · conflicts {conversionPreview.summary.conflicts}</div>}
                {collectionRoutePreview && autoSourceMode === 'collection' && <div className="alert alert-primary py-2 mt-3 mb-0 small"><b>Preview:</b> เลือก {collectionRoutePreview.selected} Collections · สร้างใหม่ {collectionRoutePreview.created} · อัปเดต {collectionRoutePreview.updated} · ไม่เปลี่ยน {collectionRoutePreview.unchanged}</div>}
                {autoToolStatus && <div className="text-success small mt-2">{autoToolStatus}</div>}{autoToolError && <div className="text-danger small mt-2">{autoToolError}</div>}
                <div className="d-flex justify-content-end gap-2 mt-3"><button className="btn btn-sm btn-outline-success me-auto" onClick={() => void recheckYiiTargets()} disabled={autoToolBusy || !platformId}><Search size={14} className="me-1"/>ReCheckYII</button><button className="btn btn-sm btn-outline-primary" onClick={() => void (autoSourceMode === 'sql' ? previewYiiSiteMap() : runCollectionSiteMap(false))} disabled={autoToolBusy || (autoSourceMode === 'sql' ? !yiiSqlText : !selectedAutoCollectionIds.length)}>{autoToolBusy ? 'กำลังทำงาน...' : '1. Preview'}</button><button className="btn btn-sm btn-primary" onClick={() => void (autoSourceMode === 'sql' ? applyYiiSiteMap() : runCollectionSiteMap(true))} disabled={autoToolBusy || (autoSourceMode === 'sql' ? !conversionPreview || conversionPreview.summary.unresolved > 0 || conversionPreview.summary.conflicts > 0 : !collectionRoutePreview)}>2. Apply & Refresh Site Map</button></div>
              </div>
              <div className="row g-2"><div className="col-md-4"><button className="btn btn-outline-secondary w-100 text-start" disabled><Sparkles size={14}/> Auto Routes from Pages<div className="small text-muted">Coming next</div></button></div><div className="col-md-4"><button className="btn btn-outline-secondary w-100 text-start" disabled><Sparkles size={14}/> Auto Menu Binding<div className="small text-muted">Coming next</div></button></div><div className="col-md-4"><button className="btn btn-outline-secondary w-100 text-start" disabled><Sparkles size={14}/> Validate & Repair<div className="small text-muted">Coming next</div></button></div></div>
            </div>
          </div>
        </div>}

        {/* Project objects remain available here even when they are not bound to Site Map. */}
        <div className="mb-2">
          <button type="button" className="btn btn-sm w-100 d-flex align-items-center gap-2 px-2 py-1.5 bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-bold" onClick={() => setResourcesOpen((value) => !value)}>{resourcesOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<Boxes size={15}/><span>ทรัพยากร</span><span className="badge bg-primary text-white ms-auto">{unboundResourcePages.length + componentResources.length + serviceResources.length}</span></button>
          {resourcesOpen && <div className="ms-3 ps-2 border-start mt-1">
            {([{ id: 'pages', label: 'Pages', icon: FileText, count: unboundResourcePages.length }, { id: 'components', label: 'App Components', icon: Puzzle, count: componentResources.length }, { id: 'services', label: 'Services', icon: Server, count: serviceResources.length }] as const).map((group) => { const GroupIcon = group.icon; const isOpen = openResourceGroups[group.id] === true; return <div key={group.id} className="mb-1"><button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-start py-1 px-1 fw-semibold text-secondary" onClick={() => setOpenResourceGroups((current) => ({ ...current, [group.id]: !isOpen }))}>{isOpen ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}<GroupIcon size={11} className="text-info"/><span>{group.label}</span><span className="badge bg-light text-secondary ms-auto">{group.count}</span></button>
              {isOpen && <div className="ms-3 ps-2 border-start">
                {group.id === 'pages' && unboundResourcePages.map((page) => <button key={page.id} type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-start text-secondary py-1 px-1" onClick={() => setActivePage(page.id)}><FileText size={10} className="text-primary"/><span className="text-truncate">{page.name}</span><span className="badge bg-light text-muted ms-auto">UNBOUND</span></button>)}
                {group.id === 'components' && componentResources.map((resource) => <button key={resource.id} type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 text-start text-secondary py-1 px-1" onClick={() => onSelectPageComponent(resource.pageId, resource.node.id)}><Box size={10} className="text-success"/><span className="text-truncate">{resource.displayName}</span><small className="text-muted ms-auto">{resource.node.type}</small></button>)}
                {group.id === 'services' && serviceResources.map((service) => <div key={service.id} className="d-flex align-items-center gap-1 text-secondary py-1 px-1" title={`Logic: Mother · Secret: ${service.config.secretEnvKey}`}><Server size={10} className="text-warning"/><span className="text-truncate">{service.name}</span>{service.id === 'service.auth.jwt' && service.bundle?.status !== 'ready' ? <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1 ms-auto" style={{ fontSize: '.55rem' }} onClick={() => void onProvisionAuthBundle()}>Setup Bundle</button> : <span className="badge bg-success bg-opacity-10 text-success ms-auto">READY</span>}</div>)}
                {group.count === 0 && <div className="text-muted py-1 px-1" style={{ fontSize: '.6rem' }}>No resources</div>}
              </div>}
            </div>; })}
          </div>}
        </div>
        
        {/* ======================================================== */}
        {/* 0. Top-Level App WorkFlow (Master Manifest) */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div
            className={`d-flex align-items-center justify-content-between px-2 py-1.5 rounded-2 cursor-pointer transition ${
              activePage === 'app_workflow'
                ? 'bg-primary text-white shadow-sm fw-bold'
                : 'stu-chrome'
            }`}
            onClick={() => setActivePage('app_workflow')}
          >
            <div className="d-flex align-items-center gap-2">
              <Workflow size={16} className={activePage === 'app_workflow' ? 'text-white' : 'text-warning'} />
              <span>ลำดับงานของเว็บไซต์</span>
            </div>
            <span className="badge bg-warning text-dark extra-small" style={{ fontSize: '0.58rem' }}>
              Master ROOT
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 1. Solution Explorer Section */}
        {/* ======================================================== */}
        {true && <><div className="mb-2">
          <div
            className="d-none align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
            onClick={() => toggleSection('solutionExplorer')}
          >
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.solutionExplorer ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={15} className="text-warning fill-warning" />
              <span>Solution Explorer</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="page" onClick={onOpenPageManager} /><span className="badge bg-secondary bg-opacity-20 text-secondary extra-small" style={{ fontSize: '0.58rem' }}>{pages.length} Pages</span></div>
          </div>

          {openSections.solutionExplorer && (
            <div className="ms-3 ps-2 border-start border-light pt-1">
              <div className="d-none align-items-center justify-content-between mb-1"><div className="text-muted extra-small fw-semibold">PAGES LAYOUTS</div><button type="button" className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center gap-1" style={{ fontSize: '0.62rem' }} onClick={() => onOpenPageManager()}><Plus size={11} /> New Page</button></div>
              {pages.map((p) => {
                const grouped = (p.componentTree || []).reduce<Record<string, { name: string; nodes: ComponentNode[] }>>((result, node) => {
                  const id = String(node.props?.__sectionId || 'main');
                  if (!result[id]) result[id] = { name: String(node.props?.__sectionName || 'Main Section'), nodes: [] };
                  result[id].nodes.push(node);
                  return result;
                }, {});
                const isOpen = activePage === p.id;
                return <div key={p.id} className="d-none my-0.5">
                  <div className={`d-flex align-items-center justify-content-between px-2 py-1 rounded-1 cursor-pointer ${isOpen ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary hover-bg-light'}`} onClick={() => setActivePage(p.id)} style={{ fontSize: '0.74rem' }}>
                    <div className="d-flex align-items-center gap-1.5 text-nowrap"><FileText size={13} className={isOpen ? 'text-white' : 'text-info'} /><span>{p.name}</span></div>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                  {isOpen && Object.entries(grouped).map(([sectionId, section]) => {
                    const sectionKey = `${p.id}:${sectionId}`;
                    const sectionOpen = openPageSections[sectionKey] !== false;
                    return <div key={sectionKey} className="ms-2 ps-2 border-start">
                      <div className="d-flex align-items-center gap-1 py-1 text-dark cursor-pointer fw-semibold" onClick={() => setOpenPageSections((current) => ({ ...current, [sectionKey]: !sectionOpen }))}>
                        {sectionOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<Layers size={12} className="text-warning" /><span>{section.name}</span><span className="badge bg-light text-secondary ms-auto">{section.nodes.length}</span>
                      </div>
                      {sectionOpen && section.nodes.map((node) => <div key={node.id} className="ms-3 d-flex align-items-center gap-1.5 py-1 px-1 rounded-1 text-secondary cursor-pointer hover-bg-light" onClick={() => onSelectPageComponent(p.id, node.id)}>
                        <Box size={11} className="text-success" /><span className="text-truncate">{String(node.props?.title || node.props?.brandName || node.type)}</span>
                      </div>)}
                    </div>;
                  })}
                  {isOpen && Object.keys(grouped).length === 0 && <div className="ms-3 ps-2 py-1 text-muted extra-small">No sections yet</div>}
                </div>;
              })}

              {false && <><div className="d-flex align-items-center justify-content-between mt-2 mb-1">
                <div className="d-flex align-items-center gap-1 text-muted extra-small fw-semibold cursor-pointer" onClick={() => setFormsOpen((value) => !value)}>
                  {formsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<Files size={12} className="text-success" /><span>FORMS</span>
                </div>
                <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: '0.56rem' }}>{forms.length} Forms</span>
              </div>
              {formsOpen && <div className="ms-1 ps-2 border-start">{Object.entries(formsByModule).map(([moduleId, moduleForms]) => {
                const moduleOpen = openFormModules[moduleId] !== false;
                return <div key={moduleId} className="mb-1">
                  <div className="d-flex align-items-center gap-1 py-1 text-dark cursor-pointer fw-semibold text-uppercase" style={{ fontSize: '0.68rem' }} onClick={() => setOpenFormModules((current) => ({ ...current, [moduleId]: !moduleOpen }))}>
                    {moduleOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<Folder size={12} className="text-warning fill-warning" /><span>{moduleId}</span><span className="badge bg-light text-secondary ms-auto">{moduleForms.length}</span>
                  </div>
                  {moduleOpen && moduleForms.map((form) => <button key={form.id} type="button" className={`btn btn-sm border-0 w-100 d-flex align-items-center gap-1.5 py-1 px-2 text-start ${activeFormId === form.id ? 'bg-success text-white fw-semibold' : 'text-secondary hover-bg-light'}`} style={{ fontSize: '0.68rem' }} onClick={() => onSelectForm(form.id, 'insert')} title={`${form.id} → ${form.collectionId}`}>
                    <FileText size={11} /><span className="text-truncate">{form.name}</span>
                  </button>)}
                </div>;
              })}{forms.length === 0 && <div className="text-muted extra-small py-2">No form definitions</div>}</div>}</>}

              <div className="d-flex align-items-center justify-content-between mt-2 mb-1">
                <div className="d-flex align-items-center gap-1 text-muted extra-small fw-semibold cursor-pointer" onClick={() => setRootCollectionsOpen((value) => !value)}>
                  {rootCollectionsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<Braces size={12} className="text-warning" /><span>COLLECTIONS</span>
                </div>
                <div className="d-flex align-items-center gap-1"><button type="button" className="btn btn-sm btn-outline-success py-0 px-1" style={{ fontSize: '.58rem' }} title="สร้าง AppComponent จากรูปภาพ" onClick={(event) => { event.stopPropagation(); onGenerateAppComponentFromImage(); }}><ImageIcon size={9}/> From Image</button><span className="badge bg-warning bg-opacity-20 text-dark" style={{ fontSize: '0.56rem' }}>{collections.length} Collections</span></div>
              </div>
              {rootCollectionsOpen && <div className="ms-1 ps-2 border-start">{Object.entries(collectionsByModule).map(([moduleId, moduleCollections]) => <div key={moduleId} className="mb-1">
                <div className="d-flex align-items-center gap-1 py-1 text-dark fw-semibold text-uppercase" style={{ fontSize: '0.68rem' }}><Folder size={12} className="text-warning fill-warning" /><span>{moduleId}</span><span className="badge bg-light text-secondary ms-auto">{moduleCollections.length}</span></div>
                {moduleCollections.map((collection) => { const isOpen = openRootCollections[collection.id] === true; return <div key={collection.id}>
                  <div className="d-flex align-items-center gap-1 px-1 py-1 text-secondary cursor-pointer rounded-1 hover-bg-light" style={{ fontSize: '0.68rem' }} onClick={() => setOpenRootCollections((current) => ({ ...current, [collection.id]: !isOpen }))} title={`${collection.id} → ${collection.table}`}>
                    {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}<Database size={11} className="text-warning" /><span className="text-truncate">{collection.name}</span><code className="ms-auto" style={{ fontSize: '0.55rem' }}>{collection.table}</code>
                  </div>
                  {isOpen && <div className="ms-3 ps-2 border-start">
                    {Object.entries(collection.components.filter((component) => component.type !== 'FormComponent').reduce<Record<string, StudioCollectionDefinition['components']>>((result, component) => { (result[collectionComponentGroup(component)] ||= []).push(component); return result; }, {})).map(([groupType, instances]) => {
                      const groupKey = `${collection.id}:${groupType}`; const groupOpen = openCollectionComponentTypes[groupKey] !== false;
                      return <div key={groupKey} className="mb-1">
                        <div className="d-flex align-items-center justify-content-between py-1 px-1 rounded-1 bg-primary bg-opacity-10 text-primary fw-semibold" style={{ fontSize: '.64rem' }}>
                          <button type="button" className="btn btn-sm border-0 p-0 text-primary d-flex align-items-center gap-1" onClick={() => setOpenCollectionComponentTypes((current) => ({ ...current, [groupKey]: !groupOpen }))}>{groupOpen ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}<Box size={10}/>{collectionComponentLabel[groupType] || groupType}<span className="badge bg-white text-primary">{instances.length}</span></button>
                          <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1" style={{ fontSize: '.58rem' }} onClick={() => onAddCollectionComponent(collection.id, instances[0].id)}><Plus size={9}/> Add</button>
                        </div>
                        {groupOpen && <div className="ms-2 ps-2 border-start">{instances.map((component) => { const instanceOpen = openCollectionComponentInstances[component.id] === true; const variants = COLLECTION_COMPONENT_VARIANTS[groupType] || ['default']; return <div key={component.id}>
                          <div draggable className="d-flex align-items-center gap-1 py-1 px-1 text-secondary cursor-grab rounded-1 hover-bg-light" style={{ fontSize: '.63rem' }} onClick={() => setOpenCollectionComponentInstances((current) => ({ ...current, [component.id]: !instanceOpen }))} onDragStart={(event) => setStudioDragData(event, { kind: 'component', componentType: component.type, label: component.label, defaultProps: component.componentTree[0]?.props || {}, sourceCollectionId: collection.id, sourceComponentId: component.id })}>
                            {instanceOpen ? <ChevronDown size={9}/> : <ChevronRight size={9}/>}<Box size={10} className="text-primary"/><span className="text-truncate">{component.label}</span>{component.recommended && <span className="badge bg-success ms-auto" style={{ fontSize: '.48rem' }}>Recommended</span>}<span className="badge bg-light text-muted">Drag</span>
                          </div>
                          {instanceOpen && <div className="ms-3 ps-2 border-start">{variants.map((variant) => <button key={variant} type="button" className={`btn btn-sm border-0 w-100 text-start py-1 px-1 ${activeCollectionViewId === component.id ? 'text-primary fw-semibold' : 'text-secondary'}`} style={{ fontSize: '.61rem' }} onClick={() => onSelectCollectionView(collection.id, component.id, variant)}><ChevronRight size={8}/> {variant}</button>)}</div>}
                        </div>; })}</div>}
                      </div>;
                    })}
                    {(() => { const collectionForms = forms.filter((form) => form.collectionId === collection.id); const formsOpenForCollection = openCollectionForms[collection.id] !== false; return <div className="mt-1">
                      <div className="d-flex align-items-center justify-content-between py-1 px-1 rounded-1 bg-success bg-opacity-10 text-success fw-semibold" style={{ fontSize: '.64rem' }}>
                        <button type="button" className="btn btn-sm border-0 p-0 text-success d-flex align-items-center gap-1" onClick={() => setOpenCollectionForms((current) => ({ ...current, [collection.id]: !formsOpenForCollection }))}>{formsOpenForCollection ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}<Files size={10}/> Forms <span className="badge bg-white text-success">{collectionForms.length}</span></button>
                        <button type="button" className="btn btn-sm btn-outline-success py-0 px-1" style={{ fontSize: '.58rem' }} onClick={() => onAddCollectionForm(collection.id)}><Plus size={9}/> Add</button>
                      </div>
                      {formsOpenForCollection && <div className="ms-2 ps-2 border-start">{collectionForms.map((form) => { const formOpen = openFormInstances[form.id] === true; return <div key={form.id}>
                        <div draggable className="d-flex align-items-center gap-1 py-1 px-1 text-secondary cursor-grab rounded-1 hover-bg-light" style={{ fontSize: '.63rem' }} onClick={() => setOpenFormInstances((current) => ({ ...current, [form.id]: !formOpen }))} onDragStart={(event) => setStudioDragData(event, { kind: 'component', componentType: 'FormComponent', label: form.name, defaultProps: { title: form.name, formId: form.id, collectionId: form.collectionId, mode: 'insert' }, sourceFormId: form.id })}>
                          {formOpen ? <ChevronDown size={9}/> : <ChevronRight size={9}/>}<FileText size={10} className="text-success"/><span className="text-truncate">{form.name}</span><span className="badge bg-light text-muted ms-auto">Drag</span>
                        </div>
                        {formOpen && <div className="ms-3 ps-2 border-start">{(['insert','update','readOnly'] as const).map((mode) => <button key={mode} type="button" className={`btn btn-sm border-0 w-100 text-start py-1 px-1 ${activeFormId === form.id ? 'text-success fw-semibold' : 'text-secondary'}`} style={{ fontSize: '.61rem' }} onClick={() => onSelectForm(form.id, mode)}><ChevronRight size={8}/> {mode}</button>)}</div>}
                      </div>; })}{collectionForms.length === 0 && <div className="text-muted py-1" style={{ fontSize: '.6rem' }}>No forms — click Add</div>}</div>}
                    </div>; })()}
                  </div>}
                </div>; })}
              </div>)}{collections.length === 0 && <div className="text-muted extra-small py-2">No collection definitions</div>}</div>}

              {false && <><div className="text-muted extra-small fw-semibold mt-2 mb-1">TENANT DATABASE</div>
              <div className="rounded-2 border bg-white overflow-hidden">
                <div className="d-flex align-items-center gap-1.5 px-2 py-1.5 text-dark fw-semibold cursor-pointer hover-bg-light" onClick={() => setTenantDatabaseOpen((value) => !value)}>
                  {tenantDatabaseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Database size={13} className="text-info" />
                  <span className="font-monospace text-truncate">{appInfo.tenantDbName}</span>
                </div>
                {tenantDatabaseOpen && <div className="ms-3 ps-2 pb-1 border-start">
                  <div className="d-flex align-items-center gap-1.5 px-1 py-1 text-secondary extra-small font-monospace">
                    <Table size={12} className="text-info" /><span>users</span>
                  </div>
                  <div className="d-flex align-items-center justify-content-between gap-1 px-1 py-1 text-dark cursor-pointer rounded-1 hover-bg-light" onClick={() => setCollectionsOpen((value) => !value)}>
                    <div className="d-flex align-items-center gap-1.5">
                      {collectionsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <Braces size={12} className="text-warning" />
                      <span className="fw-semibold">Collections</span>
                    </div>
                    <span className="badge bg-warning bg-opacity-20 text-dark" style={{ fontSize: '0.56rem' }}>{dataCollections.length}</span>
                  </div>
                  {collectionsOpen && <div className="ms-2 ps-2 border-start">
                    {Object.entries(collectionsByPage).map(([pageId, collections]) => {
                      const pageOpen = openCollectionPages[pageId] !== false;
                      return <div key={pageId}>
                        <div className="d-flex align-items-center gap-1 py-1 text-secondary cursor-pointer" onClick={() => setOpenCollectionPages((current) => ({ ...current, [pageId]: !pageOpen }))}>
                          {pageOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <FileText size={11} className="text-primary" />
                          <span className="text-truncate">{collections[0].pageName}</span>
                          <span className="badge bg-light text-secondary ms-auto">{collections.length}</span>
                        </div>
                        {pageOpen && collections.map((collection) => <button
                          type="button"
                          key={collection.id}
                          className="btn btn-sm border-0 w-100 d-flex align-items-start gap-1.5 py-1 px-1 text-start text-secondary"
                          style={{ fontSize: '0.68rem' }}
                          onClick={() => setSelectedCollection(collection)}
                          title={`${collection.sectionName} / ${collection.componentType}`}
                        >
                          <Link2 size={10} className="text-success mt-1 flex-shrink-0" />
                          <span className="text-truncate"><span className="font-monospace text-dark">{collection.componentLabel}</span><br /><span className="text-muted">{collection.dataSource !== undefined ? 'DataSource' : ''}{collection.dataSource !== undefined && collection.listSource !== undefined ? ' + ' : ''}{collection.listSource !== undefined ? 'ListSource' : ''}</span></span>
                        </button>)}
                      </div>;
                    })}
                    {dataCollections.length === 0 && <div className="text-muted py-1 px-1" style={{ fontSize: '0.66rem' }}>No component data bindings</div>}
                  </div>}
                </div>}
              </div></>}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 2. Tenant Database - shared data layer for the whole Web */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 stu-chrome cursor-pointer" onClick={() => setTenantDatabaseOpen((value) => !value)}>
            <div className="d-flex align-items-center gap-1.5 fw-bold">{tenantDatabaseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Database size={15} /><span>ฐานข้อมูลของเว็บไซต์</span></div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="database item" /><span className="adm-chip is-info">ข้อมูล</span></div>
          </div>
          {tenantDatabaseOpen && <div className="ms-3 ps-2 border-start pt-1">
            <div className="font-monospace text-primary text-truncate px-1 mb-1" style={{ fontSize: '0.68rem' }}>{appInfo.tenantDbName}</div>
            <button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 px-1 py-1 text-primary text-start fw-semibold" style={{ fontSize: '0.66rem' }} onClick={() => onSelectRawTable('__schema__')}><Sparkles size={11} className="text-warning" /><span className="text-truncate">Schema Explorer (Auto Generate)</span></button>
            {[
              { id: 'raw', label: 'Raw Tables', icon: Table, count: rawTables.length, color: 'text-info' },
              { id: 'procedures', label: 'Procedures', icon: Zap, count: databaseProcedures.length, color: 'text-danger' },
              { id: 'functions', label: 'Functions', icon: Sparkles, count: databaseFunctions.length, color: 'text-success' },
              { id: 'settings', label: 'Settings', icon: Settings, count: databaseSettings.length, color: 'text-secondary' },
            ].map((group) => {
              const GroupIcon = group.icon; const open = openDatabaseGroups[group.id] !== false;
              const entries = group.id === 'raw' ? rawTables : group.id === 'procedures' ? databaseProcedures : group.id === 'functions' ? databaseFunctions : [];
              return <div key={group.id}>
                <div className="d-flex align-items-center gap-1 py-1 px-1 cursor-pointer text-dark fw-semibold" onClick={() => setOpenDatabaseGroups((current) => ({ ...current, [group.id]: !open }))}>{open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}<GroupIcon size={12} className={group.color} /><span>{group.label}</span><span className="badge bg-light text-secondary ms-auto">{group.count}</span></div>
                {open && <div className="ms-3 ps-2 border-start">
                  {group.id === 'settings' ? databaseSettings.map((setting) => { const SettingIcon = setting.icon; return <button type="button" key={setting.id} className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 px-1 py-1 text-secondary text-start" style={{ fontSize: '0.66rem' }} onClick={() => setDatabaseSettingPage(setting.id)}><SettingIcon size={10} className="text-secondary" /><span className="text-truncate">{setting.label}</span></button>; }) : group.id === 'collections' ? Object.entries(collectionsByPage).map(([pageId, collections]) => <div key={pageId}>{collections.map((collection) => <button type="button" key={collection.id} className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 px-1 py-1 text-secondary text-start" style={{ fontSize: '0.66rem' }} onClick={() => setSelectedCollection(collection)}><Link2 size={10} className="text-warning" /><span className="text-truncate">{collection.componentLabel}</span></button>)}</div>) : entries.map((entry) => group.id === 'raw' ? <button type="button" key={entry} className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 px-1 py-1 text-secondary text-start font-monospace" style={{ fontSize: '0.65rem' }} onClick={() => openRawTableDetail(entry)}><GroupIcon size={9} className={group.color} /><span className="text-truncate">{entry}</span></button> : <div key={entry} className="d-flex align-items-center gap-1 px-1 py-1 text-secondary font-monospace" style={{ fontSize: '0.65rem' }}><GroupIcon size={9} className={group.color} /><span className="text-truncate">{entry}</span></div>)}
                </div>}
              </div>;
            })}
          </div>}
        </div>

        </>}
        {/* ======================================================== */}
        {/* 3. Platform Asset Library */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white" onClick={() => toggleSection('assets')}>
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.assets ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <ImageIcon size={15} className="text-primary" />
              <span>Assets</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="asset" /><span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.58rem' }}>{assetUsages.length} Bindings</span></div>
          </div>
          {openSections.assets && <div className="ms-3 ps-2 border-start border-light pt-1">
            <div className="text-muted extra-small fw-semibold mb-1">PLATFORM ASSET LIBRARY</div>
            {assetCategories.map((category) => {
              const AssetIcon = category.icon;
              return <button type="button" key={category.id} className="btn btn-sm border-0 w-100 d-flex align-items-center justify-content-between px-2 py-1 text-secondary" style={{ fontSize: '0.72rem' }} onClick={() => setSelectedAssetCategory(category.id)}>
                <span className="d-flex align-items-center gap-1.5"><AssetIcon size={12} className={category.color} /><span>{category.label}</span></span>
                <ChevronRight size={10} />
              </button>;
            })}
            {assetUsages.length > 0 && <div className="mt-2 pt-1 border-top"><div className="text-muted fw-semibold px-2 mb-1" style={{ fontSize: '.62rem' }}>DRAGGABLE ASSETS</div>{assetUsages.map((asset) => <div
              key={asset.id}
              draggable
              className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-1 border bg-white text-secondary cursor-grab mb-1"
              style={{ fontSize: '.66rem' }}
              title={`Drag asset://${asset.assetId} to HTML Studio`}
              onDragStart={(event) => setStudioDragData(event, { kind: 'asset', assetId: asset.assetId, label: asset.assetId, assetType: 'image' })}
            ><ImageIcon size={11} className="text-primary"/><span className="text-truncate">{asset.assetId}</span><span className="badge bg-primary bg-opacity-10 text-primary ms-auto">Drag</span></div>)}</div>}
            <div className="mt-1 pt-1 border-top">
              <button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1.5 px-2 py-1 text-success" style={{ fontSize: '0.69rem' }} onClick={() => setSelectedAssetCategory('legacy-yii')} title="Import selected content assets from the legacy YII project">
                <HardDriveDownload size={12} /><span className="text-truncate">Legacy YII Source</span><span className="badge bg-success bg-opacity-10 text-success ms-auto">Import</span>
              </button>
            </div>
          </div>}
        </div>

        {/* ======================================================== */}
        {/* 3. Site Map & Flow Section */}
        {/* ======================================================== */}
        {false && <><div className="mb-2">
          <div
            className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
            onClick={() => toggleSection('siteMapFlow')}
          >
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.siteMapFlow ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <MapPin size={15} className="text-danger" />
              <span>Site Map & Flow</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="route" /><span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.58rem' }}>เส้นทาง</span></div>
          </div>

          {openSections.siteMapFlow && (
            <div className="ms-3 ps-2 border-start border-light pt-1">
              <div className="text-muted extra-small fw-semibold mb-1">โครงสร้างผังเว็บไซต์</div>
              {siteRoutes.map((r) => (
                <div key={r.path} className="d-flex align-items-center justify-content-between px-2 py-1 text-secondary extra-small rounded-1 cursor-pointer hover-bg-light" onClick={() => onSelectPageFlow(r)}>
                  <span>{r.label} (<code>{r.path}</code>)</span>
                </div>
              ))}

              <div className="mt-2 pt-1 border-top">
                <Link
                  href="/flow-studio"
                  className="btn btn-sm btn-outline-info w-100 d-flex align-items-center justify-content-center gap-1.5 py-1 text-nowrap extra-small"
                  style={{ fontSize: '0.72rem' }}
                >
                  <Workflow size={13} />
                  <span>Open Flow Studio</span>
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          )}
        </div>

        </>}
        {/* ======================================================== */}
        {/* 3. BasicComponents Section */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div
            className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
            onClick={() => toggleSection('basicComponents')}
          >
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.basicComponents ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Puzzle size={15} className="text-primary" />
              <span>BasicComponents</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="basic component" /><span className="badge bg-primary bg-opacity-10 text-primary extra-small" style={{ fontSize: '0.58rem' }}>{basicItems.length} Controls</span></div>
          </div>

          {openSections.basicComponents && (
            <div className="ms-3 ps-2 border-start border-light pt-1 d-flex flex-column gap-1">
              {basicItems.map((item) => (
                <div
                  key={item.type}
                  draggable
                  className="d-flex align-items-center justify-content-between p-1.5 px-2 rounded-1 bg-white border border-light hover-border-primary cursor-pointer hover-shadow transition"
                  onClick={() => onAddComponent(item)}
                  onDragStart={(event) => setStudioDragData(event, { kind: 'component', componentType: item.type, label: item.label, defaultProps: item.defaultProps })}
                  style={{ transition: 'all 0.15s ease' }}
                >
                  <div className="d-flex align-items-center gap-1.5 text-nowrap overflow-hidden">
                    <Sparkles size={12} className="text-primary flex-shrink-0" />
                    <span className="fw-medium extra-small text-dark text-truncate">{item.label}</span>
                  </div>
                  <button className="btn btn-sm btn-outline-primary py-0 px-1.5 rounded-1 extra-small ms-1 flex-shrink-0" style={{ fontSize: '0.62rem' }}>
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 4. AppComponents Section */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div
            className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
            onClick={() => toggleSection('appComponents')}
          >
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.appComponents ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Box size={15} className="text-success" />
              <span>AppComponents</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="app component" /><span className="badge bg-success bg-opacity-10 text-success extra-small" style={{ fontSize: '0.58rem' }}>{appItems.length} Modules</span></div>
          </div>

          {openSections.appComponents && (
            <div className="ms-3 ps-2 border-start border-light pt-1 d-flex flex-column gap-1">
              {Object.entries(appItemsByCategory).map(([category, items]) => {
                const isOpen = openAppCategories[category] !== false;
                return <div key={category}>
                  <button type="button" className="btn btn-sm border-0 w-100 d-flex align-items-center gap-1 px-1 py-1 text-dark fw-semibold" style={{ fontSize: '.68rem' }} onClick={() => setOpenAppCategories((current) => ({ ...current, [category]: !isOpen }))}>
                    {isOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}<Boxes size={12} className="text-success"/><span>{category}</span><span className="badge bg-light text-secondary ms-auto">{items.length}</span>
                  </button>
                  {isOpen && <div className="ms-2 ps-2 border-start d-flex flex-column gap-1">{items.map((item) => {
                    const instances = componentInventoryByType[item.type] || [];
                    const typeOpen = openAppTypes[item.type] === true;
                    return <div key={item.type}>
                      <div className="d-flex align-items-center justify-content-between p-1.5 px-2 rounded-1 bg-white border border-light hover-border-success transition">
                        <button type="button" className="btn btn-sm border-0 p-0 d-flex align-items-center gap-1.5 text-nowrap overflow-hidden text-dark flex-grow-1 text-start" onClick={() => setOpenAppTypes((current) => ({ ...current, [item.type]: !typeOpen }))}>
                          {typeOpen ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}<Box size={12} className="text-success flex-shrink-0"/><span className="fw-medium extra-small text-truncate">{item.label}</span><span className="badge bg-light text-secondary ms-auto me-1">{instances.length}</span>
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-success py-0 px-1.5 rounded-1 extra-small flex-shrink-0" style={{ fontSize: '.62rem' }} onClick={() => onAddComponent(item)}><Plus size={10}/> Add</button>
                      </div>
                      {typeOpen && <div className="ms-3 ps-2 border-start mt-1 d-flex flex-column gap-1">
                        {instances.map((instance) => <div key={instance.id} draggable className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-1 bg-light border cursor-grab" style={{ fontSize: '.64rem' }} title={`Drag ${instance.displayName} from ${instance.pageName}`} onDragStart={(event) => setStudioDragData(event, { kind: 'component', componentType: instance.node.type, label: instance.displayName, defaultProps: instance.node.props, sourcePageId: instance.pageId, sourceNodeId: instance.node.id })}>
                          <FileText size={10} className="text-info flex-shrink-0"/><span className="text-truncate flex-grow-1"><span className="fw-semibold">{instance.displayName}</span><br/><span className="text-muted">{instance.pageName}</span></span><span className="badge bg-success bg-opacity-10 text-success">Drag</span>
                        </div>)}
                        {instances.length === 0 && <div className="text-muted px-2 py-1" style={{ fontSize: '.62rem' }}>ยังไม่มี instance ชนิดนี้ใน Page</div>}
                      </div>}
                    </div>;
                  })}</div>}
                </div>;
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 5. Service Assign Section */}
        {/* ======================================================== */}
        <div className="mb-2">
          <div
            className="d-flex align-items-center justify-content-between px-2 py-1 rounded-1 bg-light border border-light cursor-pointer hover-bg-white"
            onClick={() => toggleSection('serviceAssign')}
          >
            <div className="d-flex align-items-center gap-1.5 text-dark fw-bold">
              {openSections.serviceAssign ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Server size={15} className="text-info" />
              <span>Service Assign</span>
            </div>
            <div className="d-flex align-items-center gap-1"><MenuAddButton label="service" /><span className="badge bg-info bg-opacity-10 text-info extra-small" style={{ fontSize: '0.58rem' }}>API & DB Bindings</span></div>
          </div>

          {openSections.serviceAssign && (
            <div className="ms-3 ps-2 border-start border-light pt-1 text-secondary extra-small">
              <div className="p-2 bg-light rounded-2 border mb-1">
                <span className="fw-bold text-dark d-block mb-0.5">Tenant API Endpoints</span>
                <code>GET /api/v1/tenant/users</code>
              </div>
              <div className="p-2 bg-light rounded-2 border">
                <span className="fw-bold text-dark d-block mb-0.5">Webhook Handlers</span>
                <code>POST /api/v1/events/submit</code>
              </div>
            </div>
          )}
        </div>

      </div>
      {databaseSettingPage && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 2200, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.currentTarget === event.target) setDatabaseSettingPage(null); }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(95vw, 920px)', minHeight: 540, maxHeight: '88vh' }}>
          <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(120deg,#0B1F3A,#0C58A9)' }}>
            <div className="d-flex align-items-center justify-content-between"><div><div className="small text-info fw-bold d-flex align-items-center gap-1"><Settings size={14} /> TENANT DATABASE SETTINGS</div><h5 className="mb-0 fw-bold font-monospace">{appInfo.tenantDbName}</h5></div><button type="button" className="btn btn-sm btn-outline-light border-0" onClick={() => setDatabaseSettingPage(null)} aria-label="Close"><X size={18} /></button></div>
          </div>
          <div className="card-body p-0 d-flex overflow-hidden">
            <nav className="border-end bg-light p-2 flex-shrink-0" style={{ width: 190 }}>
              {databaseSettings.map((setting) => { const SettingIcon = setting.icon; return <button type="button" key={setting.id} className={`btn btn-sm w-100 border-0 text-start d-flex align-items-center gap-2 px-2 py-2 mb-1 ${databaseSettingPage === setting.id ? 'btn-primary text-white' : 'text-dark'}`} onClick={() => setDatabaseSettingPage(setting.id)}><SettingIcon size={14} />{setting.label}</button>; })}
            </nav>
            <div className="p-4 overflow-auto flex-grow-1">
              {databaseSettingPage === 'connection' && <>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                  <div className="d-flex align-items-center gap-2"><PlugZap size={18} className="text-primary" /><h5 className="mb-0 fw-bold">Connection Profile</h5></div>
                  <button type="button" className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" onClick={() => void loadConnectionProfiles()} disabled={connectionProfileBusy}><Clock3 size={13} />Refresh</button>
                </div>
                <p className="text-muted small">App ใช้ Connection Profile ฝั่ง server เท่านั้น Browser เห็นแค่ config ที่ไม่ลับและสถานะ SecretRef</p>
                <div className="row g-2 mb-3 small">
                  {[['App', appInfo.appSlug], ['Default DB', appInfo.tenantDbName], ['Active profile', activeConnectionProfile?.profileKey || 'ยังไม่ได้เลือก'], ['Status', activeConnectionProfile?.status || 'UNBOUND']].map(([label, value]) => <div className="col-sm-6" key={label}><label className="form-label text-muted mb-1">{label}</label><input className="form-control form-control-sm font-monospace" value={value} readOnly /></div>)}
                </div>
                <div className="border rounded-3 p-3 bg-light mb-3">
                  <label className="form-label small fw-semibold">App connection selector</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text"><KeyRound size={13} /></span>
                    <select className="form-select" value={selectedConnectionProfileId} onChange={(event) => setSelectedConnectionProfileId(event.target.value)} disabled={connectionProfileBusy}>
                      <option value="">No external profile / use provisioned App DB</option>
                      {connectionProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.profileName} · {profile.profileKey} · {profile.status}</option>)}
                    </select>
                    <button type="button" className="btn btn-primary" onClick={() => void bindConnectionProfile()} disabled={connectionProfileBusy || selectedConnectionProfileId === (activeConnectionProfile?.id || '')}>Apply</button>
                  </div>
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    {activeConnectionProfile && <button type="button" className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => void validateConnectionProfile(activeConnectionProfile.id)} disabled={connectionProfileBusy}><Play size={13} />Validate active profile</button>}
                    {activeConnectionProfile && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setSelectedConnectionProfileId(''); void bindConnectionProfile(''); }} disabled={connectionProfileBusy}>Unbind</button>}
                    <button type="button" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => { setEditingConnectionProfile(null); setShowConnectionProfileCreate((value) => !value); }} disabled={connectionProfileBusy}><Plus size={13} />New profile</button>
                  </div>
                </div>
                {showConnectionProfileCreate && <div className="border rounded-3 p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <div><div className="fw-bold text-dark">{editingConnectionProfile ? 'Edit POSTGRES profile' : 'New POSTGRES profile'}</div><div className="small text-muted">{editingConnectionProfile ? 'Secret references stay unchanged while editing config and policy.' : 'Secret values must already exist as server env SecretRefs.'}</div></div>
                    <span className="badge bg-primary-subtle text-primary">{editingConnectionProfile ? `v${editingConnectionProfile.editVersion}` : 'SecretRef only'}</span>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-md-6"><label className="form-label text-muted mb-1">Profile key</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.profileKey} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, profileKey: event.target.value }))} disabled={Boolean(editingConnectionProfile)} /></div>
                    <div className="col-md-6"><label className="form-label text-muted mb-1">Profile name</label><input className="form-control form-control-sm" value={connectionProfileDraft.profileName} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, profileName: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label text-muted mb-1">Host</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.host} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, host: event.target.value }))} /></div>
                    <div className="col-md-3"><label className="form-label text-muted mb-1">Port</label><input className="form-control form-control-sm font-monospace" type="number" min={1} max={65535} value={connectionProfileDraft.port} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, port: Number(event.target.value) }))} /></div>
                    <div className="col-md-3"><label className="form-label text-muted mb-1">Pool max</label><input className="form-control form-control-sm font-monospace" type="number" min={1} max={20} value={connectionProfileDraft.poolMax} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, poolMax: Number(event.target.value) }))} /></div>
                    <div className="col-md-6"><label className="form-label text-muted mb-1">Database</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.database} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, database: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label text-muted mb-1">SSL mode</label><select className="form-select form-select-sm" value={connectionProfileDraft.sslMode} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, sslMode: event.target.value }))}>{['disable', 'prefer', 'require', 'verify-full'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></div>
                    {!editingConnectionProfile && <div className="col-md-6"><label className="form-label text-muted mb-1">Username SecretRef</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.usernameRef} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, usernameRef: event.target.value }))} /></div>}
                    {!editingConnectionProfile && <div className="col-md-6"><label className="form-label text-muted mb-1">Password SecretRef</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.passwordRef} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, passwordRef: event.target.value }))} /></div>}
                    {editingConnectionProfile && <div className="col-md-12"><div className="alert alert-info py-2 mb-0">SecretRef values are hidden and unchanged by this edit. Rotate them through the protected secret store, then validate again.</div></div>}
                    <div className="col-md-8"><label className="form-label text-muted mb-1">Allowed module keys</label><input className="form-control form-control-sm font-monospace" value={connectionProfileDraft.allowedModuleKeys} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, allowedModuleKeys: event.target.value }))} /></div>
                    <div className="col-md-4 d-flex align-items-end"><label className="form-check small mb-2"><input className="form-check-input" type="checkbox" checked={connectionProfileDraft.allowRuntimeWrite} onChange={(event) => setConnectionProfileDraft((draft) => ({ ...draft, allowRuntimeWrite: event.target.checked }))} /><span className="form-check-label">Allow runtime writes</span></label></div>
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setEditingConnectionProfile(null); setShowConnectionProfileCreate(false); }} disabled={connectionProfileBusy}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void createConnectionProfile()} disabled={connectionProfileBusy}>{editingConnectionProfile ? 'Save profile' : 'Create profile'}</button>
                  </div>
                </div>}
                {activeConnectionProfile && <div className="border rounded-3 p-3 mb-3">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div><div className="fw-bold text-dark">{activeConnectionProfile.profileName}</div><code>{activeConnectionProfile.profileKey}</code></div>
                    <span className={`badge ${activeConnectionProfile.status === 'READY' ? 'bg-success' : activeConnectionProfile.status === 'ERROR' ? 'bg-danger' : activeConnectionProfile.status === 'DISABLED' ? 'bg-secondary' : 'bg-warning text-dark'}`}>{activeConnectionProfile.status}</span>
                  </div>
                  <div className="row g-2 small">
                    {Object.entries(activeConnectionProfile.config).map(([key, value]) => <div className="col-sm-6" key={key}><span className="text-muted d-block">{key}</span><code className="text-break">{Array.isArray(value) ? value.join(', ') : String(value)}</code></div>)}
                  </div>
                  <div className="mt-3">
                    <div className="text-muted small fw-semibold mb-1">Secret references</div>
                    <div className="d-flex flex-wrap gap-1">
                      {activeConnectionProfile.secretReferences.map((secret) => <span key={secret.key} className={`badge ${secret.configured ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>{secret.key}: {secret.provider}{secret.configured ? ' ready' : ' missing'}</span>)}
                    </div>
                  </div>
                  <div className="mt-3 small text-muted">Modules: {activeConnectionProfile.policy.allowedModuleKeys.join(', ') || 'none'} · Runtime write: {activeConnectionProfile.policy.allowRuntimeWrite ? 'allowed' : 'blocked'}</div>
                  <button type="button" className="btn btn-outline-primary btn-sm mt-3" onClick={() => startEditingConnectionProfile(activeConnectionProfile)} disabled={connectionProfileBusy}>Edit config and policy</button>
                  {activeConnectionProfile.lastErrorCode && <div className="alert alert-danger py-2 mt-3 mb-0 small">{activeConnectionProfile.lastErrorCode}</div>}
                </div>}
                {!activeConnectionProfile && <div className="alert alert-info py-2 mb-3 small">ยังไม่ได้ผูก Connection Profile ภายนอก App จะใช้ฐานข้อมูลที่ provision ไว้เอง</div>}
                {connectionProfileStatus && <div className="alert alert-success py-2 mb-2 small">{connectionProfileStatus}</div>}
                {connectionProfileError && <div className="alert alert-danger py-2 mb-2 small">{connectionProfileError}</div>}
                <div className="alert alert-warning py-2 mt-3 mb-0 small">ค่า SecretRef ถูกเก็บและตรวจฝั่ง server เท่านั้น UI นี้ไม่แสดงหรือรับรหัสผ่านจริง</div>
              </>}
              {databaseSettingPage === 'api' && <>
                <div className="d-flex align-items-center gap-2 mb-1"><Braces size={18} className="text-warning" /><h5 className="mb-0 fw-bold">Database API</h5></div><p className="text-muted small">Endpoint กลางสำหรับ Studio และ App ลูก โดยระบบระบุฐานข้อมูลจาก Platform identity</p>
                {[['POST', `/api/platforms/${platformId || ':platformId'}/database/query`, 'รัน SELECT / WITH / EXPLAIN แบบ read-only'], ['GET', `/api/platforms/${platformId || ':platformId'}/database/tables`, 'รายชื่อตารางและโครงสร้างคอลัมน์'], ['GET', `/api/platforms/${platformId || ':platformId'}/database/health`, 'ตรวจสถานะการเชื่อมต่อ'], ['POST', `/api/platforms/${platformId || ':platformId'}/database/records/:table`, 'เพิ่มข้อมูลผ่าน policy ของ App'], ['PATCH', `/api/platforms/${platformId || ':platformId'}/database/records/:table/:id`, 'แก้ไขข้อมูลผ่าน policy ของ App'], ['DELETE', `/api/platforms/${platformId || ':platformId'}/database/records/:table/:id`, 'ลบข้อมูลผ่าน policy ของ App']].map(([method, path, description]) => <div key={`${method}-${path}`} className="border rounded-3 p-2 mb-2"><div className="d-flex gap-2 align-items-center"><span className={`badge ${method === 'GET' ? 'bg-success' : method === 'DELETE' ? 'bg-danger' : 'bg-primary'}`}>{method}</span><code className="text-dark text-break">{path}</code></div><div className="small text-muted mt-1">{description}</div></div>)}
              </>}
              {databaseSettingPage === 'tools' && <>
                <div className="d-flex align-items-center gap-2 mb-1"><Wrench size={18} className="text-secondary" /><h5 className="mb-0 fw-bold">Database Tools</h5></div><p className="text-muted small">พื้นที่สำหรับสำรอง ย้าย และกู้คืนฐานข้อมูลด้วย script ในอนาคต</p>
                <div className="row g-3 mt-1"><div className="col-md-6"><div className="border rounded-3 p-3 h-100"><Download size={24} className="text-primary mb-2" /><h6 className="fw-bold">Export Script</h6><p className="small text-muted">สร้าง SQL dump แยก schema, data หรือทั้ง database พร้อม audit log</p><button className="btn btn-outline-primary btn-sm" disabled>Coming soon</button></div></div><div className="col-md-6"><div className="border rounded-3 p-3 h-100"><Upload size={24} className="text-success mb-2" /><h6 className="fw-bold">Import Script</h6><p className="small text-muted">ตรวจสอบ script ใน sandbox ก่อน restore และรองรับ dry-run</p><button className="btn btn-outline-success btn-sm" disabled>Coming soon</button></div></div></div>
                <div className="alert alert-warning py-2 mt-3 mb-0 small">Import/Export จะทำงานผ่าน background job ไม่รัน script โดยตรงจาก browser</div>
              </>}
            </div>
          </div>
        </div>
      </div>}
      {selectedRawTable && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 2200, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedRawTable(null); }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(96vw, 1100px)', height: 'min(90vh, 760px)' }}>
          <div className="card-header border-0 text-white px-3 py-2" style={{ background: 'linear-gradient(120deg,#0B1F3A,#083A6E)' }}>
            <div className="d-flex align-items-center justify-content-between gap-3">
              <div><div className="small text-info fw-bold d-flex align-items-center gap-1"><Table size={14} /> RAW TABLE DETAIL</div><div className="d-flex align-items-baseline gap-2"><h5 className="mb-0 fw-bold font-monospace">{selectedRawTable}</h5><span className="small opacity-75 font-monospace">{appInfo.tenantDbName}</span></div></div>
              <button type="button" className="btn btn-sm btn-outline-light border-0" onClick={() => setSelectedRawTable(null)} aria-label="Close"><X size={18} /></button>
            </div>
          </div>
          <div className="card-body p-0 d-flex flex-column overflow-hidden">
            <div className="px-3 py-2 border-bottom bg-light">
              <div className="d-flex align-items-stretch gap-2">
                <div className="border rounded-3 bg-white px-3 py-2 flex-grow-1 overflow-hidden">
                  <div className="d-flex align-items-center gap-1 text-primary fw-bold small"><Database size={13} /> WEB แม่ · STRUCTURE</div>
                  <div className="font-monospace small text-truncate mt-1">{selectedRawTable}</div>
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>เก็บ columns, types, indexes และ relations สำหรับออกแบบ</div>
                </div>
                <div className="d-flex flex-column align-items-center justify-content-center text-secondary px-1" style={{ minWidth: 82 }}><ArrowRight size={22} /><span className="fw-semibold text-nowrap" style={{ fontSize: '0.62rem' }}>PUBLISH / SYNC</span></div>
                <div className="border border-success rounded-3 bg-success bg-opacity-10 px-3 py-2 flex-grow-1 overflow-hidden">
                  <div className="d-flex align-items-center gap-1 text-success fw-bold small"><Boxes size={13} /> APP ลูก · ACTUAL DATA</div>
                  <div className="font-monospace small text-truncate mt-1">{appInfo.tenantDbName}.{selectedRawTable}</div>
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>ตารางจริงและข้อมูล Content อยู่ใน Tenant Database ของ App ลูก</div>
                </div>
              </div>
            </div>
            <section className="d-flex flex-column border-bottom" style={{ minHeight: 220, flex: '0 0 42%' }}>
              <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-light">
                <div><div className="fw-bold small d-flex align-items-center gap-2"><Terminal size={14} className="text-primary" /> SQL Editor</div><div className="text-muted" style={{ fontSize: '0.65rem' }}>Target: App ลูก / Tenant Database · Structure ด้านบนใช้เพื่อช่วยเขียน SQL เท่านั้น</div></div>
                <button type="button" disabled={isQueryRunning} className="btn btn-success btn-sm d-flex align-items-center gap-1 px-3" onClick={() => void runRawTableQuery()}><Play size={13} fill="currentColor" /> {isQueryRunning ? 'Running…' : 'Run on App ลูก'}</button>
              </div>
              <div className="d-flex flex-grow-1 bg-dark overflow-hidden">
                <div className="text-secondary font-monospace text-end px-2 py-3 border-end border-secondary" style={{ fontSize: '0.78rem', lineHeight: 1.65, minWidth: 38 }}>{sqlQuery.split('\n').map((_, index) => <div key={index}>{index + 1}</div>)}</div>
                <textarea value={sqlQuery} onChange={(event) => setSqlQuery(event.target.value)} spellCheck={false} className="form-control border-0 rounded-0 bg-dark text-light font-monospace p-3 shadow-none resize-none" style={{ fontSize: '0.82rem', lineHeight: 1.65, resize: 'none' }} aria-label="SQL query editor" />
              </div>
            </section>
            <section className="d-flex flex-column flex-grow-1 overflow-hidden">
              <div className="d-flex align-items-center justify-content-between border-bottom bg-white px-2">
                <div className="nav nav-tabs border-0">
                  {([{ id: 'table', label: 'ตาราง', icon: Grid3X3 }, { id: 'json', label: 'JSON', icon: Braces }, { id: 'log', label: 'Log', icon: Terminal }] as const).map((tab) => { const TabIcon = tab.icon; return <button key={tab.id} type="button" className={`nav-link border-0 rounded-0 d-flex align-items-center gap-1 py-2 ${queryResultTab === tab.id ? 'active fw-bold border-bottom border-primary border-2 text-primary' : 'text-secondary'}`} onClick={() => setQueryResultTab(tab.id)}><TabIcon size={13} /> {tab.label}</button>; })}
                </div>
                <div className="small text-muted d-flex align-items-center gap-1 pe-2"><Clock3 size={12} /> {queryRows.length} rows{queryDurationMs !== null ? ` · ${queryDurationMs} ms` : ''}</div>
              </div>
              <div className="flex-grow-1 overflow-auto bg-white">
                {queryResultTab === 'table' && <div className="table-responsive"><table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.78rem' }}><thead className="table-light sticky-top"><tr>{queryColumns.map((column) => <th key={column} className="px-3 py-2 text-nowrap font-monospace">{column}</th>)}</tr></thead><tbody>{queryRows.map((row, rowIndex) => <tr key={rowIndex}>{queryColumns.map((column, columnIndex) => <td key={column} className="px-3 py-2 text-nowrap font-monospace">{row[columnIndex] === null ? <span className="text-muted">NULL</span> : typeof row[columnIndex] === 'object' ? JSON.stringify(row[columnIndex]) : String(row[columnIndex])}</td>)}</tr>)}</tbody></table>{!isQueryRunning && !queryError && queryColumns.length === 0 && <div className="text-center text-muted p-5">กด Run query เพื่อแสดงผลลัพธ์</div>}</div>}
                {queryResultTab === 'json' && <pre className="m-0 p-3 bg-dark text-light h-100 small overflow-auto">{JSON.stringify(queryRows.map((row) => Object.fromEntries(queryColumns.map((column, index) => [column, row[index]]))), null, 2)}</pre>}
                {queryResultTab === 'log' && <div className="bg-dark text-light h-100 p-3 font-monospace small"><div className="text-warning">SOURCE  Web แม่ → table structure: {selectedRawTable}</div><div className="text-success">TARGET  App ลูก → database: {appInfo.tenantDbName}</div><div className="text-secondary mt-2">[{queryRunAt?.toLocaleTimeString('th-TH') || '--:--:--'}] Query actual content data</div><div className="text-info mt-1">{sqlQuery.replace(/\s+/g, ' ').trim()}</div>{queryError ? <div className="text-danger mt-2">ERROR: {queryError}</div> : queryRunAt ? <div className="text-success mt-2">Query completed successfully — {queryRows.length} rows returned{queryDurationMs !== null ? ` in ${queryDurationMs} ms` : ''}.</div> : <div className="text-secondary mt-2">Ready. SQL จะไม่อ่านข้อมูล Content จากฐานข้อมูลแม่</div>}</div>}
              </div>
            </section>
          </div>
        </div>
      </div>}
      {selectedCollection && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 2200, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedCollection(null); }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(94vw, 720px)', maxHeight: '88vh' }}>
          <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(120deg,#1b3810,#2e5d1c)' }}>
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div><div className="small text-warning fw-bold d-flex align-items-center gap-1"><Braces size={14} /> TENANT DATA COLLECTION</div><h5 className="mb-1 fw-bold">{selectedCollection.componentLabel}</h5><div className="small opacity-75 font-monospace">{selectedCollection.id}</div></div>
              <button type="button" className="btn btn-sm btn-outline-light border-0" onClick={() => setSelectedCollection(null)} aria-label="Close"><X size={18} /></button>
            </div>
          </div>
          <div className="card-body overflow-auto p-3">
            <div className="row g-2 mb-3 small">
              <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><div className="text-muted extra-small">PAGE</div><div className="fw-semibold">{selectedCollection.pageName}</div><code>{selectedCollection.pageId}.page</code></div></div>
              <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><div className="text-muted extra-small">SECTION</div><div className="fw-semibold">{selectedCollection.sectionName}</div><code>{selectedCollection.sectionId}</code></div></div>
              <div className="col-md-12"><div className="bg-light rounded-3 p-2"><div className="text-muted extra-small">COMPONENT</div><div className="fw-semibold">{selectedCollection.componentType}</div><code>{selectedCollection.componentId}</code></div></div>
            </div>
            {selectedCollection.dataSource !== undefined && <div className="mb-3"><div className="d-flex align-items-center gap-1 fw-bold mb-1"><Database size={14} className="text-primary" /> DataSource</div><pre className="bg-dark text-light rounded-3 p-3 mb-0 small overflow-auto" style={{ maxHeight: '240px' }}>{JSON.stringify(selectedCollection.dataSource, null, 2)}</pre></div>}
            {selectedCollection.listSource !== undefined && <div><div className="d-flex align-items-center gap-1 fw-bold mb-1"><Braces size={14} className="text-warning" /> ListSource</div><pre className="bg-dark text-light rounded-3 p-3 mb-0 small overflow-auto" style={{ maxHeight: '240px' }}>{JSON.stringify(selectedCollection.listSource, null, 2)}</pre></div>}
            <div className="alert alert-info py-2 mt-3 mb-0 small"><strong>Binding:</strong> collection นี้ถูกสร้างจาก Page AST และจะอัปเดตตาม Properties ของ Component เมื่อบันทึก Page</div>
          </div>
          <div className="card-footer bg-white d-flex justify-content-end p-2"><button type="button" className="btn btn-primary btn-sm px-4" onClick={() => setSelectedCollection(null)}>Close</button></div>
        </div>
      </div>}
      {selectedAssetCategory && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 2200, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedAssetCategory(null); }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(94vw,760px)', maxHeight: '88vh' }}>
          <div className="card-header border-0 text-white p-3" style={{ background: 'linear-gradient(120deg,#172554,#1d4ed8)' }}>
            <div className="d-flex justify-content-between align-items-start"><div><div className="small text-info fw-bold">PLATFORM ASSET LIBRARY</div><h5 className="mb-0 fw-bold">{selectedAssetCategory === 'legacy-yii' ? 'Import from Legacy YII' : assetCategories.find((item) => item.id === selectedAssetCategory)?.label}</h5></div><button type="button" className="btn btn-sm btn-outline-light border-0" onClick={() => setSelectedAssetCategory(null)}><X size={18} /></button></div>
          </div>
          <div className="card-body overflow-auto p-3">
            {selectedAssetCategory === 'legacy-yii' ? <>
              <div className="alert alert-warning small"><strong>ไม่ควรนำเข้า web/assets ทั้งหมด:</strong> โฟลเดอร์นี้มี asset bundle ที่ Yii publish รวม JavaScript/CSS ของ third-party และ hashed directories ซึ่งเปลี่ยนได้เมื่อ deploy</div>
              <div className="fw-bold mb-2">แหล่งที่ควรนำเข้าคลัง Assets</div>
              {['frontend/web/img — Logo, ภาพประจำเว็บไซต์ และภาพ UI', 'frontend/web/uploads — ภาพและเอกสารเนื้อหา', 'frontend/web/ebook — หนังสือและปกเอกสาร', 'frontend/web/fav — Favicon และ application icons'].map((path) => <div key={path} className="border rounded-3 p-2 mb-2 d-flex align-items-center gap-2 small"><HardDriveDownload size={15} className="text-success" /><code>{path}</code></div>)}
              <div className="alert alert-info small mb-0">การ Import ขั้นถัดไปจะคัดลอกไฟล์เข้าสู่ managed storage, สร้าง Asset ID และบันทึก metadata แทนการอ้าง path เดิมโดยตรง</div>
            </> : <>
              <div className="d-flex justify-content-between align-items-center mb-3"><div><div className="fw-bold">Managed {assetCategories.find((item) => item.id === selectedAssetCategory)?.label}</div><div className="text-muted small">Assets จะถูกเลือกผ่าน Asset ID ใน Property Page ของ Component</div></div><button type="button" className="btn btn-primary btn-sm" disabled>+ Upload Asset</button></div>
              <div className="border rounded-3 p-4 text-center text-muted"><ImageIcon size={28} className="mb-2 opacity-50" /><div className="fw-semibold">Asset storage schema จะเป็นขั้นถัดไป</div><div className="small">Tree และ Usage Binding พร้อมรองรับแล้ว</div></div>
              {assetUsages.length > 0 && <div className="mt-3"><div className="fw-bold small mb-2">Current Component Usage</div>{assetUsages.map((usage) => <div key={usage.id} className="bg-light rounded-3 p-2 mb-1 small"><code>{usage.assetId}</code><span className="text-muted"> → {usage.pageName} / {usage.componentType}.{usage.property}</span></div>)}</div>}
            </>}
          </div>
          <div className="card-footer bg-white d-flex justify-content-end p-2"><button type="button" className="btn btn-primary btn-sm px-4" onClick={() => setSelectedAssetCategory(null)}>Close</button></div>
        </div>
      </div>}
    </div>
  );
};
