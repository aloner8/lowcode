'use client';

import React, { useState } from 'react';
import { DynamicPageRenderer } from '@/components/engine/DynamicPageRenderer';
import { CheckCircle2 } from 'lucide-react';
import type { ComponentNode, ThemeConfig } from '@/types';

/**
 * Interactive shell for a published site.
 *
 * Everything it needs arrives as serialisable props from the Server Component,
 * so the initial HTML is already complete and indexable. This component only
 * adds behaviour on top of markup the server already rendered.
 */

export interface SiteRuntimeViewProps {
  readonly appSlug: string;
  readonly themeConfig: ThemeConfig;
  readonly componentTree: ComponentNode[];
  readonly forms: Array<{ id: string; componentTree: ComponentNode[] }>;
  readonly collections: Array<{
    id: string;
    name?: string;
    standardFlows?: Record<string, any>;
    components: Array<{ id: string; type: string; componentTree: ComponentNode[] }>;
  }>;
}

export function SiteRuntimeView({
  appSlug,
  themeConfig,
  componentTree,
  forms,
  collections,
}: SiteRuntimeViewProps) {
  const [selectedContent, setSelectedContent] = useState<ComponentNode[] | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const handleMenuSelect = (payload: any) => {
    const resource = payload?.resource;
    let nodes: ComponentNode[] | undefined;

    if (resource?.componentType === 'FormComponent' && resource.formId) {
      nodes = forms.find((form) => form.id === resource.formId)?.componentTree;
    } else if (resource?.collectionId) {
      const collection = collections.find((item) => item.id === resource.collectionId);
      nodes = collection?.components.find(
        (item) => item.id === resource.componentId || item.type === resource.componentType,
      )?.componentTree;
    }

    if (!nodes?.length) {
      setNotice(`ยังไม่พบ Component binding สำหรับเมนู '${payload?.label || payload?.id}'`);
      return;
    }
    const params = resource.params || {};
    setSelectedContent(nodes.map((node) => ({ ...node, props: { ...node.props, ...params, routeParams: params } })));
    setSelectedLabel(payload.label || resource.route || '');
    setNotice(null);
  };

  const handleView = (payload: any) => {
    const collection = collections.find((item) => item.id === payload?.collectionId);
    const flow = collection?.standardFlows?.view;
    const view = collection?.components.find((item) => item.id === flow?.componentId);

    if (!collection || !view?.componentTree?.length) {
      setNotice(`ไม่พบ ViewDetail สำหรับ Collection '${payload?.collectionId || '-'}'`);
      return;
    }
    const row = payload?.row || {};
    const recordId = row[flow?.rowIdField || 'id'];
    setSelectedContent(view.componentTree.map((node) => ({
      ...node,
      props: { ...node.props, mode: 'preview', recordId, data: row, routeParams: { mode: 'preview', id: recordId } },
    })));
    setSelectedLabel(`${collection.name || collection.id}${recordId !== undefined ? ` #${recordId}` : ''}`);
    setNotice(null);
  };

  const handleEditOrCreate = (actionId: 'edit' | 'create', payload: any) => {
    const collection = collections.find((item) => item.id === payload?.collectionId);
    const flow = collection?.standardFlows?.[actionId];
    const formId =
      flow?.formId ||
      payload?.formId ||
      (payload?.collectionId ? String(payload.collectionId).replace(/\.collection$/, '.form') : undefined);
    const form = forms.find((item) => item.id === formId);

    if (!collection || !form?.componentTree?.length) {
      setNotice(`ไม่พบ Standard Form Flow สำหรับ Collection '${payload?.collectionId || '-'}'`);
      return;
    }
    const row = payload?.row || {};
    const mode = actionId === 'edit' ? 'update' : 'insert';
    const recordId = actionId === 'edit' ? row[flow?.rowIdField || 'id'] : undefined;

    setSelectedContent(form.componentTree.map((node) => ({
      ...node,
      props: {
        ...node.props, mode, recordId,
        initialValues: actionId === 'edit' ? row : {},
        collectionId: collection.id, formId,
        routeParams: { mode, ...(recordId !== undefined ? { id: recordId } : {}) },
      },
    })));
    setSelectedLabel(`${actionId === 'edit' ? 'แก้ไข' : 'เพิ่ม'} ${collection.name || collection.id}`);
    setNotice(null);
  };

  /** Writes go through the public runtime API, which enforces the insert allow-list. */
  const handleSubmit = async (payload: any) => {
    const table = payload?.table || payload?.dataSource?.table;
    if (!table) {
      setNotice('ฟอร์มนี้ยังไม่ได้ผูกตารางปลายทาง (dataSource.table)');
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
      setNotice(`บันทึกข้อมูลลงตาราง ${table} เรียบร้อยแล้ว`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  const handleActionTrigger = async (actionId: string, payload: any) => {
    if (actionId === 'menu.select') return handleMenuSelect(payload);
    if (actionId === 'view') return handleView(payload);
    if (actionId === 'edit' || actionId === 'create') return handleEditOrCreate(actionId, payload);
    if (actionId === 'submit' || actionId.endsWith('.submit')) return handleSubmit(payload);
    setNotice(null);
  };

  const navigation = componentTree.filter((node) => node.type === 'SlideMenuComponent');

  return (
    <>
      {notice && (
        <output className="alert alert-info border-0 rounded-0 mb-0 py-2 text-center small fw-semibold d-block">
          <CheckCircle2 size={16} className="me-1" /> {notice}
        </output>
      )}

      {selectedContent ? (
        <div className="d-flex align-items-start gap-3 p-3">
          {navigation.length > 0 && (
            <div className="flex-shrink-0">
              <DynamicPageRenderer
                nodes={navigation}
                themeConfig={themeConfig}
                onActionTrigger={handleActionTrigger}
                rootTag="aside"
              />
            </div>
          )}
          <div className="flex-grow-1 min-w-0">
            {selectedLabel && <p className="small text-muted mb-2">{selectedLabel}</p>}
            <DynamicPageRenderer
              nodes={selectedContent}
              themeConfig={themeConfig}
              onActionTrigger={handleActionTrigger}
              rootTag="main"
            />
          </div>
        </div>
      ) : (
        <DynamicPageRenderer
          nodes={componentTree}
          themeConfig={themeConfig}
          onActionTrigger={handleActionTrigger}
        />
      )}
    </>
  );
}
