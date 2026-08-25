'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchAppRuntimeData, AppRuntimeData } from '@/lib/engine/AppRuntimeFetcher';
import { DynamicPageRenderer } from '@/components/engine/DynamicPageRenderer';
import { WorkflowInterpreter } from '@/lib/engine/WorkflowInterpreter';
import { getTenantDbClient } from '@/lib/supabase/tenantClient';
import { Server, Database, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';
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

export default function ChildAppRuntimePage() {
  const params = useParams();
  const appSlug = (params?.appSlug as string) || 'client-a';

  const [runtimeData, setRuntimeData] = useState<AppRuntimeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<ComponentNode[] | null>(null);
  const [selectedMenuLabel, setSelectedMenuLabel] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchAppRuntimeData(appSlug);
      setRuntimeData(data);
      setLoading(false);
    }
    loadData();
  }, [appSlug]);

  if (loading || !runtimeData) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <RefreshCw size={32} className="text-primary spin mb-2" />
        <h5 className="fw-bold text-dark">Loading App Dynamic Player...</h5>
        <p className="text-muted small">Fetching Layout JSON, Theme Tokens & Workflow AST from DB</p>
      </div>
    );
  }

  const { appConfig, pageLayout, workflowTree } = runtimeData;

  const handleActionTrigger = async (actionId: string, payload: any) => {
    if (actionId === 'menu.select') {
      const selectedMenu = resolveCanonicalMenuItem(payload || {});
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
    setLastAction(`Event '${actionId}' triggered with data: ${JSON.stringify(payload)}`);

    // Execute workflow if available
    if (workflowTree) {
      const interpreter = new WorkflowInterpreter(workflowTree);
      await interpreter.executeTrigger(actionId, {
        payload,
        appId: appConfig.id,
        showAlert: (msg) => alert(`[Tenant App Alert]\n${msg}`),
      });
    } else {
      // Direct Tenant DB interaction demo
      const tenantClient = getTenantDbClient(appConfig.tenantDbName);
      console.log(`[Tenant DB Client Connected] DB: ${appConfig.tenantDbName}`, tenantClient);
      alert(`[Tenant DB Action Executed]\nSaved to Tenant Database: '${appConfig.tenantDbName}'\nPayload: ${JSON.stringify(payload, null, 2)}`);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column municipal-admin-runtime">
      {/* Top Banner indicating Tenant Dynamic Player status */}
      <div className="bg-dark text-white py-2 px-3 shadow-sm border-bottom">
        <div className="container-fluid d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-3">
            <span className="badge bg-success px-3 py-1">Thin Dynamic Player (Child App)</span>
            <small className="font-monospace text-info d-flex align-items-center me-2">
              <Server size={14} className="me-1" /> Subdomain Port: :{appConfig.port}
            </small>
            <small className="font-monospace text-warning d-flex align-items-center">
              <Database size={14} className="me-1" /> Isolated DB: {appConfig.tenantDbName}
            </small>
          </div>

          <div className="small text-muted">
            Host Nginx Mapping Target: <span className="text-white fw-bold">{appConfig.subdomain}</span>
          </div>
        </div>
      </div>

      {/* Action Event Toast */}
      {lastAction && (
        <div className="alert alert-info border-0 rounded-0 mb-0 py-2 text-center small fw-semibold">
          <CheckCircle2 size={16} className="me-1 inline" /> {lastAction}
        </div>
      )}

      {/* Dynamic Page Renderer with Theme Engine */}
      <div className="flex-grow-1">
        {selectedContent ? <div className="municipal-admin-layout d-flex align-items-start gap-0">
          <div className="flex-shrink-0"><DynamicPageRenderer nodes={pageLayout.componentTree.filter((node) => node.type === 'SlideMenuComponent')} themeConfig={appConfig.themeConfig} onActionTrigger={handleActionTrigger} /></div>
          <main className="municipal-admin-content flex-grow-1 min-w-0"><div className="municipal-admin-breadcrumb">หน้าหลัก <span>›</span> {selectedMenuLabel}</div><DynamicPageRenderer nodes={selectedContent} themeConfig={appConfig.themeConfig} onActionTrigger={handleActionTrigger} /></main>
        </div> : <DynamicPageRenderer nodes={pageLayout.componentTree} themeConfig={appConfig.themeConfig} onActionTrigger={handleActionTrigger} />}
      </div>
    </div>
  );
}
