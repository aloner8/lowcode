'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AppRuntimeData } from '@/lib/engine/AppRuntimeFetcher';
import { RuntimeContentOutlet } from '@/components/engine/RuntimeContentOutlet';
import { StorageScopeProvider } from '@/components/shared/StorageScopeContext';
import { WorkflowInterpreter } from '@/lib/engine/WorkflowInterpreter';
import { CheckCircle2 } from 'lucide-react';
import type { ComponentNode } from '@/types';
import { ADMIN_SIDEBAR_ITEMS } from '@/lib/studio/adminMenuTemplate';
import type { SlideMenuItem } from '@/components/shared/SlideMenuComponent';

const flattenMenuItems = (items: SlideMenuItem[]): SlideMenuItem[] =>
  items.flatMap((item) => [item, ...(item.children ? flattenMenuItems(item.children) : [])]);

const canonicalMenuItems = flattenMenuItems(ADMIN_SIDEBAR_ITEMS);

const resolveCanonicalMenuItem = (item: SlideMenuItem): SlideMenuItem => {
  const canonical = canonicalMenuItems.find((candidate) =>
    candidate.id === item.id
    || (Boolean(item.href) && candidate.href === item.href)
    || (candidate.label === item.label && candidate.type !== 'section'),
  );
  return canonical
    ? { ...canonical, ...item, resource: { ...canonical.resource, ...item.resource } as SlideMenuItem['resource'] }
    : item;
};

export interface SiteRuntimeViewProps {
  readonly appSlug: string;
  /** Tenant App id, used to scope File Manager storage. Null for a bare platform preview. */
  readonly appId: string | null;
  readonly runtimeData: AppRuntimeData;
  /**
   * Tree the server already rendered for this URL. Keeping it as the initial
   * state means the markup a crawler received is exactly what hydrates.
   */
  readonly initialContent: ComponentNode[];
}

/**
 * Interactive shell for a published site.
 *
 * All data arrives from the Server Component, so nothing is fetched to paint
 * the first screen; this component only adds navigation and actions on top of
 * markup the server already produced.
 */
export function SiteRuntimeView({ appSlug, appId, runtimeData, initialContent }: SiteRuntimeViewProps) {
  const pathname = usePathname();

  const [lastAction, setLastAction] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<ComponentNode[] | null>(null);
  const [selectedMenuLabel, setSelectedMenuLabel] = useState<string>('');
  const [contentOutletMode, setContentOutletMode] = useState<'content' | 'page'>('page');


  useEffect(() => {
    if (!runtimeData) return;
    const prefix = `/app/${appSlug}`;
    const requestedPath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : '/';
    const route = runtimeData.routes?.find((item) => item.path === requestedPath || item.legacyPaths?.includes(requestedPath));
    if (!route) return;
    if (route.targetType === 'page' && route.targetId) {
      const page = runtimeData.pages?.find((item) => item.id === route.targetId);
      const authService = runtimeData.services?.find((item) => item.id === 'service.auth.jwt');
      if (page && route.targetId === authService?.bundle?.adminPageId && !window.sessionStorage.getItem(`auth:${appSlug}:accessToken`)) {
        const loginPage = runtimeData.pages?.find((item) => item.id === authService.bundle?.loginPageId);
        if (loginPage?.componentTree?.length) { setSelectedContent(loginPage.componentTree); setSelectedMenuLabel(loginPage.title || 'Login'); setContentOutletMode('page'); window.history.replaceState({}, '', `/app/${appSlug}/login`); }
        return;
      }
      if (page?.componentTree?.length) { setSelectedContent(page.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('page'); }
    } else if (route.targetType === 'form' && route.targetId) {
      const form = runtimeData.forms?.find((item) => item.id === route.targetId);
      if (form?.componentTree?.length) { setSelectedContent(form.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('content'); }
    } else if (route.targetType === 'collection' && route.targetId) {
      const collection = runtimeData.collections?.find((item) => item.id === route.targetId);
      const view = collection?.components.find((item) => item.type === 'DataTableComponent') || collection?.components[0];
      if (view?.componentTree?.length) { setSelectedContent(view.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('content'); }
    } else if (route.targetType === 'external' && route.externalUrl) window.location.replace(route.externalUrl);
  }, [appSlug, pathname, runtimeData]);


  const { appConfig, workflowTree } = runtimeData;

  const handleActionTrigger = async (actionId: string, payload: any): Promise<void> => {
    if (actionId === 'auth.login.submit') {
      try {
        setLastAction('Checking credentials...');
        const response = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}),
        });
        const result = await response.json() as { token?: string; successPageId?: string; error?: string };
        if (!response.ok || !result.token) throw new Error(result.error || 'Login failed');
        window.sessionStorage.setItem(`auth:${appSlug}:accessToken`, result.token);
        const page = runtimeData.pages?.find((item) => item.id === result.successPageId);
        if (!page?.componentTree?.length) throw new Error(`Success Page '${result.successPageId}' not found`);
        setSelectedContent(page.componentTree); setSelectedMenuLabel(page.title || 'Admin'); setContentOutletMode('page'); setLastAction(null);
        const route = runtimeData.routes?.find((item) => item.targetType === 'page' && item.targetId === page.id);
        window.history.pushState({}, '', `/app/${appSlug}${route?.path || '/admin'}`);
      } catch (error) { setLastAction(error instanceof Error ? error.message : 'Login failed'); }
      return;
    }
    if (actionId === 'logout') {
      window.sessionStorage.removeItem(`auth:${appSlug}:accessToken`);
      const service = runtimeData.services?.find((item) => item.id === 'service.auth.jwt');
      const page = runtimeData.pages?.find((item) => item.id === service?.bundle?.loginPageId);
      if (page?.componentTree?.length) {
        setSelectedContent(page.componentTree); setSelectedMenuLabel(page.title || 'Login'); setContentOutletMode('page'); setLastAction(null);
        window.history.pushState({}, '', `/app/${appSlug}/login`);
      }
      return;
    }
    if (actionId === 'menu.select') {
      const selectedMenu = resolveCanonicalMenuItem(payload || {});
      const action = selectedMenu.action;
      if (action?.type === 'switchContent' && action.contentId) {
        try {
          setLastAction(`Loading content '${action.contentId}'...`);
          const response = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}/content/${encodeURIComponent(action.contentId)}`, { cache: 'no-store' });
          const result = await response.json() as { componentTree?: ComponentNode[]; error?: string };
          if (!response.ok || !result.componentTree?.length) throw new Error(result.error || 'Content not found');
          const params = action.params || {};
          setSelectedContent(result.componentTree.map((node) => ({ ...node, props: { ...node.props, ...params, appSlug, routeParams: params } })));
          setSelectedMenuLabel(selectedMenu.label || action.contentId); setContentOutletMode('content'); setLastAction(null);
        } catch (error) { setLastAction(error instanceof Error ? error.message : 'Unable to switch content'); }
        return;
      }
      if (action?.type === 'navigatePage' && action.pageId) {
        const page = runtimeData.pages?.find((item) => item.id === action.pageId);
        if (page?.componentTree?.length) { setSelectedContent(page.componentTree); setSelectedMenuLabel(selectedMenu.label || page.title || action.pageId); setContentOutletMode('page'); setLastAction(null); }
        else setLastAction(`Page '${action.pageId}' not found`);
        return;
      }
      if (action?.type === 'openExternal' && action.url) {
        if (action.newTab !== false) window.open(action.url, '_blank', 'noopener,noreferrer'); else window.location.assign(action.url);
        return;
      }
      if (action?.type === 'runService' && action.serviceId) {
        if (workflowTree) await new WorkflowInterpreter(workflowTree).executeTrigger(action.serviceId, { payload: action.payload, appId: appConfig.id, showAlert: (msg) => alert(msg) });
        setLastAction(`Service '${action.serviceId}' executed`); return;
      }
      if (action?.type === 'callApi' && action.url) {
        try {
          const response = await fetch(action.url, { method: action.method || 'GET', headers: action.payload ? { 'Content-Type': 'application/json' } : undefined, body: action.payload ? JSON.stringify(action.payload) : undefined });
          if (!response.ok) throw new Error(`API returned ${response.status}`);
          const result = await response.json().catch(() => ({}));
          setLastAction(`API '${action.apiId || action.url}' completed: ${JSON.stringify(result).slice(0, 160)}`);
          if (action.resultContentId) {
            const contentResponse = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}/content/${encodeURIComponent(action.resultContentId)}`, { cache: 'no-store' });
            const content = await contentResponse.json() as { componentTree?: ComponentNode[] };
            if (content.componentTree) setSelectedContent(content.componentTree.map((node) => ({ ...node, props: { ...node.props, data: result, appSlug } })));
          }
        } catch (error) { setLastAction(error instanceof Error ? error.message : 'API call failed'); }
        return;
      }
      if (action?.type === 'triggerAction') { await handleActionTrigger(action.actionId, action.payload); return; }
      if (action?.type === 'none') return;
      const routeId = action?.type === 'openRoute' || action?.type === 'navigateRoute' ? action.routeId : selectedMenu.routeId;
      const route = routeId ? runtimeData.routes?.find((item) => item.id === routeId) : undefined;
      if (route) {
        if (route.targetType === 'external' && route.externalUrl) { window.open(route.externalUrl, '_blank', 'noopener,noreferrer'); return; }
        if (route.targetType === 'page' && route.targetId) {
          const page = runtimeData.pages?.find((item) => item.id === route.targetId);
          if (page?.componentTree?.length) {
            setSelectedContent(page.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('page'); setLastAction(null);
            window.history.pushState({ routeId: route.id }, '', `/app/${appSlug}${route.path === '/' ? '' : route.path}`);
            return;
          }
        }
        if (route.targetType === 'form' && route.targetId) {
          const form = runtimeData.forms?.find((item) => item.id === route.targetId);
          if (form?.componentTree?.length) {
            setSelectedContent(form.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('content'); setLastAction(null);
            window.history.pushState({ routeId: route.id }, '', `/app/${appSlug}${route.path === '/' ? '' : route.path}`);
            return;
          }
        }
        if (route.targetType === 'collection' && route.targetId) {
          const collection = runtimeData.collections?.find((item) => item.id === route.targetId);
          const view = collection?.components.find((item) => item.type === 'DataTableComponent') || collection?.components[0];
          if (view?.componentTree?.length) {
            setSelectedContent(view.componentTree); setSelectedMenuLabel(route.label); setContentOutletMode('content'); setLastAction(null);
            window.history.pushState({ routeId: route.id }, '', `/app/${appSlug}${route.path === '/' ? '' : route.path}`);
            return;
          }
        }
        if (route.targetType === 'legacy' && route.legacyPaths?.[0]) { window.location.assign(route.legacyPaths[0]); return; }
      }
      const resource = selectedMenu.resource;
      let nodes: ComponentNode[] | undefined;
      if (resource?.componentType === 'FormComponent' && resource.formId) {
        nodes = runtimeData.forms?.find((form) => form.id === resource.formId)?.componentTree;
      } else if (resource?.collectionId) {
        const collection = runtimeData.collections?.find((item) => item.id === resource.collectionId);
        const view = collection?.components.find((item) => item.id === resource.componentId || item.type === resource.componentType);
        nodes = view?.componentTree;
      }
      if (nodes?.length) {
        const params = resource?.params || {};
        setSelectedContent(nodes.map((node) => ({ ...node, props: { ...node.props, ...params, routeParams: params } })));
        setSelectedMenuLabel(selectedMenu.label || resource?.route || '');
        setLastAction(null);
      } else {
        setLastAction(`ยังไม่พบ Component binding สำหรับเมนู '${selectedMenu.label || selectedMenu.id}'`);
      }
      return;
    }
    if (actionId === 'view') {
      const collection = runtimeData.collections?.find((item) => item.id === payload?.collectionId);
      const flow = collection?.standardFlows?.view;
      const view = collection?.components.find((item) => item.id === flow?.componentId);
      if (collection && view?.componentTree?.length) {
        const row = payload?.row || {};
        const recordId = row[flow?.rowIdField || 'id'];
        setSelectedContent(view.componentTree.map((node) => ({ ...node, props: { ...node.props, mode: 'preview', recordId, data: row, routeParams: { mode: 'preview', id: recordId } } })));
        setSelectedMenuLabel(`Preview ${collection.name || collection.id}${recordId !== undefined ? ` #${recordId}` : ''}`);
        setLastAction(null);
      } else setLastAction(`ไม่พบ ViewDetail สำหรับ Collection '${payload?.collectionId || '-'}'`);
      return;
    }
    if (actionId === 'edit' || actionId === 'create') {
      const collection = runtimeData.collections?.find((item) => item.id === payload?.collectionId);
      const flow = collection?.standardFlows?.[actionId];
      const formId = flow?.formId || payload?.formId || (payload?.collectionId ? String(payload.collectionId).replace(/\.collection$/, '.form') : undefined);
      const form = runtimeData.forms?.find((item) => item.id === formId);
      if (collection && form?.componentTree?.length) {
        const row = payload?.row || {};
        const rowIdField = flow?.rowIdField || 'id';
        const mode = actionId === 'edit' ? 'update' : 'insert';
        const recordId = actionId === 'edit' ? row[rowIdField] : undefined;
        setSelectedContent(form.componentTree.map((node) => ({
          ...node,
          props: { ...node.props, mode, recordId, initialValues: actionId === 'edit' ? row : {}, collectionId: collection.id, formId, routeParams: { mode, ...(recordId !== undefined ? { id: recordId } : {}) } },
        })));
        setSelectedMenuLabel(`${actionId === 'edit' ? 'แก้ไข' : 'เพิ่ม'} ${collection.name || collection.id}${recordId !== undefined ? ` #${recordId}` : ''}`);
        setLastAction(null);
      } else {
        setLastAction(`ไม่พบ Standard Form Flow สำหรับ Collection '${payload?.collectionId || '-'}'`);
      }
      return;
    }
    // Form submissions persist into this site's own tenant database. The table
    // must be listed in the platform's public insert allow-list, or the API
    // refuses the write.
    if (actionId === 'submit' || actionId.endsWith('.submit')) {
      const table = payload?.table || payload?.dataSource?.table;
      if (!table) {
        setLastAction('ฟอร์มนี้ยังไม่ได้ผูกตารางปลายทาง (dataSource.table)');
        return;
      }
      try {
        const response = await fetch(
          `/api/runtime/${encodeURIComponent(appSlug)}/records/${encodeURIComponent(table)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload?.values ?? payload),
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ');
        setLastAction(`บันทึกข้อมูลลงตาราง ${table} เรียบร้อยแล้ว`);
      } catch (error) {
        setLastAction(error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ');
      }
      return;
    }

    setLastAction(`Event '${actionId}' triggered with data: ${JSON.stringify(payload)}`);

    if (workflowTree) {
      const interpreter = new WorkflowInterpreter(workflowTree);
      await interpreter.executeTrigger(actionId, {
        payload,
        appId: appConfig.id,
        showAlert: (message) => setLastAction(message),
      });
    }
  };

  return (
    <StorageScopeProvider scope={{ appId: appId ?? undefined }}>
    <div className="min-vh-100 bg-light d-flex flex-column municipal-admin-runtime">
      {/* Runtime diagnostics — development only: never expose tenant DB names publicly. */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="bg-dark text-white py-2 px-3 shadow-sm border-bottom">
          <div className="container-fluid d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="badge bg-success px-3 py-1">Thin Dynamic Player (Child App)</span>
            <small className="font-monospace text-warning">{appConfig.tenantDbName}</small>
          </div>
        </div>
      )}

      {/* Action Event Toast */}
      {lastAction && (
        <div className="alert alert-info border-0 rounded-0 mb-0 py-2 text-center small fw-semibold">
          <CheckCircle2 size={16} className="me-1" /> {lastAction}
        </div>
      )}

      {/* Dynamic Page Renderer with Theme Engine */}
      <div className="flex-grow-1">
        <RuntimeContentOutlet
          mode={selectedContent ? contentOutletMode : 'page'}
          content={selectedContent ?? initialContent}
          shellNodes={initialContent.filter((node) => node.type === 'SlideMenuComponent')}
          label={selectedMenuLabel}
          themeConfig={appConfig.themeConfig}
          onActionTrigger={handleActionTrigger}
        />
      </div>
    </div>
    </StorageScopeProvider>
  );
}
