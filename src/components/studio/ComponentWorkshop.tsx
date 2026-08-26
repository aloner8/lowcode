'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Braces, Database, Palette, Save, SlidersHorizontal, Workflow } from 'lucide-react';
import type { ComponentNode } from '@/types';
import type { StudioCollectionDefinition } from '@/lib/studio/backendFormDefinitions';
import type { HtmlStudioDocument, StudioNode } from '@/lib/html-studio';
import { HtmlStudioShell } from '@/components/html-studio';
import { SharedComponentPropertyPage } from './SharedComponentPropertyPage';
import { SlideMenuRouteBuilder } from './SlideMenuRouteBuilder';
import type { SlideMenuItem } from '@/components/shared/SlideMenuComponent';

interface ComponentWorkshopProps {
  pageName: string;
  component: ComponentNode;
  collections: StudioCollectionDefinition[];
  pages?: Array<{ id: string; name: string; routePath?: string }>;
  onBack: () => void;
  onSave: (component: ComponentNode) => void;
}

const defaultHtmlId = (component: ComponentNode) => `cmp-${component.id.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}`;
const normalizeInstance = (component: ComponentNode): ComponentNode => ({
  ...structuredClone(component),
  templateRef: component.templateRef || `component://${component.type}`,
  htmlId: component.htmlId || defaultHtmlId(component),
});

const toStudioNode = (component: ComponentNode): StudioNode => ({
  id: component.id,
  kind: 'component',
  componentRef: { id: component.type, scope: 'app', displayName: component.label || component.type },
  attributes: { ...structuredClone(component.props || {}), id: component.htmlId || defaultHtmlId(component), 'data-component-instance-id': component.id },
  children: [],
});

export const ComponentWorkshop: React.FC<ComponentWorkshopProps> = ({ pageName, component, collections, pages, onBack, onSave }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'html' | 'collection' | 'style' | 'events'>('properties');
  const [draft, setDraft] = useState<ComponentNode>(() => normalizeInstance(component));
  const [styleText, setStyleText] = useState(() => JSON.stringify(component.style || {}, null, 2));
  const [eventText, setEventText] = useState(() => JSON.stringify(component.props?.events || [], null, 2));
  const [fixedItemsText, setFixedItemsText] = useState(() => JSON.stringify(component.props?.items || [], null, 2));
  const document = useMemo<HtmlStudioDocument>(() => {
    const stored = component.props?.workshopDocument as HtmlStudioDocument | undefined;
    if (stored) return stored;
    const now = new Date().toISOString();
    return {
      id: `component_workshop_${component.id}`,
      scope: 'app', kind: 'section', name: component.label || component.type, version: 1, schemaVersion: 1,
      root: [toStudioNode(normalizeInstance(component))],
      styleSheet: { scopeId: `component-${component.id.replace(/[^A-Za-z0-9_-]/g, '-')}`, rules: [] },
      dependencies: [], settings: { cssScope: 'component', dataPolicy: 'collection-read', scriptPolicy: 'none' },
      createdAt: now, updatedAt: now,
    };
  }, [component]);

  const commit = (next = draft) => {
    try {
      const explicitCollectionIds = [next.props?.collectionId, next.props?.dataSource?.collectionId, ...(Array.isArray(next.props?.collectionIds) ? next.props.collectionIds : [])].filter((value): value is string => typeof value === 'string' && Boolean(value));
      if (new Set(explicitCollectionIds).size > 1) { window.alert('Component หนึ่งตัวอ้างได้เพียง 1 Collection กรุณาเลือก Collection เดียว'); return; }
      const fixedItems = next.props?.items;
      if (next.type === 'SlideMenuComponent' && next.props?.dataSourceMode !== 'collection' && !Array.isArray(fixedItems)) throw new Error('INVALID_ITEMS');
      onSave({ ...next, templateRef: next.templateRef || `component://${next.type}`, htmlId: next.htmlId || defaultHtmlId(next), style: JSON.parse(styleText || '{}'), props: { ...next.props, ...(fixedItems ? { items: fixedItems } : {}), events: JSON.parse(eventText || '[]') } });
    } catch { window.alert('Style หรือ Events JSON ไม่ถูกต้อง'); }
  };

  const tabs = [
    { id: 'properties' as const, label: 'Properties', icon: <SlidersHorizontal size={13}/> },
    { id: 'html' as const, label: 'HTML IDE', icon: <Braces size={13}/> },
    { id: 'collection' as const, label: 'Collection', icon: <Database size={13}/> },
    { id: 'style' as const, label: 'Set Style', icon: <Palette size={13}/> },
    { id: 'events' as const, label: 'Events', icon: <Workflow size={13}/> },
  ];

  const selectSlideMenuCollection = (collectionId: string) => {
    const collection = collections.find((item) => item.id === collectionId);
    const sourceNode = collection?.components.find((item) => item.type === 'ListComponent')?.componentTree[0] || collection?.components[0]?.componentTree[0];
    const sample = (sourceNode?.props?.items || sourceNode?.props?.data || []) as Array<Record<string, unknown>>;
    setDraft({ ...draft, props: { ...draft.props, collectionIds: undefined, dataSourceMode: 'collection', collectionId: collectionId || undefined, collectionItems: sample, dataSource: collection ? { kind: 'collection', collectionId, table: collection.table } : undefined, collectionMapping: { idField: 'id', labelField: collection?.table === 'cms_menu' ? 'name' : 'name', hrefField: collection?.table === 'cms_menu' ? 'link' : 'href', parentIdField: collection?.table === 'cms_menu' ? 'menu_id' : 'parent_id', ...(draft.props?.collectionMapping || {}) } } });
  };

  const updateMapping = (key: string, value: string) => setDraft({ ...draft, props: { ...draft.props, collectionMapping: { ...(draft.props?.collectionMapping || {}), [key]: value } } });

  return <div className="card border-0 shadow-sm h-100 overflow-hidden d-flex flex-column">
    <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between py-2">
      <div className="d-flex align-items-center gap-2"><button className="btn btn-sm btn-outline-light" onClick={onBack}><ArrowLeft size={14}/></button><div><strong>Component Workshop</strong><div className="text-white-50" style={{ fontSize: '.7rem' }}>{pageName} / {String(component.props?.__sectionName || 'Main Section')} / {component.label || component.type}</div></div></div>
      <button className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={() => commit()}><Save size={13}/> Save Component</button>
    </div>
    <div className="bg-white border-bottom px-3 py-2"><div className="row g-2 align-items-end">
      <div className="col-lg-4"><label className="form-label mb-1 text-muted" style={{ fontSize: '.68rem' }}>TEMPLATE REFERENCE (แม่แบบ)</label><input className="form-control form-control-sm font-monospace" value={draft.templateRef || `component://${draft.type}`} disabled/></div>
      <div className="col-lg-4"><label className="form-label mb-1 text-muted" style={{ fontSize: '.68rem' }}>INSTANCE ID (ถาวร/แก้ไม่ได้)</label><input className="form-control form-control-sm font-monospace" value={draft.id} disabled/></div>
      <div className="col-lg-4"><label className="form-label mb-1 text-muted" style={{ fontSize: '.68rem' }}>HTML ID (DOM/CSS)</label><input className="form-control form-control-sm font-monospace" value={draft.htmlId || ''} onChange={(event) => setDraft({ ...draft, htmlId: event.target.value.replace(/[^A-Za-z0-9_:-]/g, '-') })}/></div>
    </div></div>
    <div className="d-flex border-bottom bg-light px-2 pt-2 gap-1">{tabs.map((tab) => <button key={tab.id} className={`btn btn-sm rounded-bottom-0 d-flex align-items-center gap-1 ${activeTab === tab.id ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveTab(tab.id)}>{tab.icon}{tab.label}</button>)}</div>
    <div className="flex-grow-1 overflow-auto">
      {activeTab === 'properties' && <SharedComponentPropertyPage component={draft} onChange={setDraft} pages={pages}/>}
      {activeTab === 'html' && <HtmlStudioShell embedded document={{ ...document, root: document.root.map((node, index) => index === 0 ? { ...node, id: draft.id, componentRef: { ...node.componentRef!, id: draft.type }, attributes: { ...node.attributes, ...draft.props, id: draft.htmlId || defaultHtmlId(draft), 'data-component-instance-id': draft.id } } : node) }} onSave={(nextDocument) => { const next = { ...draft, props: { ...draft.props, workshopDocument: nextDocument } }; setDraft(next); commit(next); }}/>} 
      {activeTab === 'collection' && draft.type === 'SlideMenuComponent' && <div className="p-4"><h5>Slide Menu Data Source</h5><p className="text-muted small">เลือกแหล่งข้อมูลของเมนู โดย Component instance หนึ่งตัวเลือกได้เพียงหนึ่ง Collection และการเลือกใหม่จะแทนที่ของเดิม</p>
        <div className="btn-group mb-3"><button className={`btn btn-sm ${draft.props?.dataSourceMode !== 'collection' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setDraft({ ...draft, props: { ...draft.props, collectionIds: undefined, collectionId: undefined, collectionItems: undefined, dataSource: undefined, dataSourceMode: 'fixed-json' } })}>1. Fixed JSON</button><button className={`btn btn-sm ${draft.props?.dataSourceMode === 'collection' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setDraft({ ...draft, props: { ...draft.props, dataSourceMode: 'collection' } })}>2. Collections</button></div>
        {draft.props?.dataSourceMode !== 'collection' ? <SlideMenuRouteBuilder items={(Array.isArray(draft.props?.items) ? draft.props.items : []) as SlideMenuItem[]} pages={pages} onChange={(items) => { setFixedItemsText(JSON.stringify(items, null, 2)); setDraft({ ...draft, props: { ...draft.props, dataSourceMode: 'fixed-json', items } }); }}/> : <div>
          <label className="form-label fw-semibold">Collection</label><select className="form-select mb-3" value={String(draft.props?.collectionId || '')} onChange={(event) => selectSlideMenuCollection(event.target.value)}><option value="">เลือก Collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name} ({collection.table})</option>)}</select>
          <div className="row g-2">{[['idField','ID Field'],['labelField','Label Field'],['hrefField','Link Field'],['parentIdField','Parent ID Field'],['typeField','Type Field'],['badgeField','Badge Field'],['permissionField','Permission Field']].map(([key, label]) => <div className="col-md-6" key={key}><label className="form-label small mb-1">{label}</label><input className="form-control form-control-sm font-monospace" value={String(draft.props?.collectionMapping?.[key] || '')} onChange={(event) => updateMapping(key, event.target.value)}/></div>)}</div>
          <div className="alert alert-info py-2 small mt-3 mb-2">Preview ใช้ sample records ของ Collection; runtime สามารถส่ง records ล่าสุดผ่าน <code>collectionData</code></div><label className="form-label small fw-semibold">Collection sample</label><pre className="bg-dark text-light rounded p-3 small overflow-auto" style={{ maxHeight: 220 }}>{JSON.stringify(draft.props?.collectionItems || [], null, 2)}</pre>
        </div>}
      </div>}
      {activeTab === 'collection' && draft.type !== 'SlideMenuComponent' && <div className="p-4"><h5>Collection Source</h5><p className="text-muted small">Component หนึ่งตัวเลือกได้เพียงหนึ่ง Collection; การเลือกใหม่จะแทนที่ Collection เดิม</p><select className="form-select" value={String(draft.props?.collectionId || '')} onChange={(event) => setDraft({ ...draft, props: { ...draft.props, collectionIds: undefined, collectionId: event.target.value || undefined, dataSource: event.target.value ? { ...(draft.props?.dataSource || {}), collectionId: event.target.value } : undefined } })}><option value="">ไม่ผูก Collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name} ({collection.table})</option>)}</select></div>}
      {activeTab === 'style' && <div className="p-4"><h5>Component Style</h5><p className="text-muted small">กำหนด style เฉพาะ component ด้วย JSON</p><textarea className="form-control font-monospace" rows={18} value={styleText} onChange={(event) => setStyleText(event.target.value)}/></div>}
      {activeTab === 'events' && <div className="p-4"><h5>Component Events</h5><p className="text-muted small">กำหนด event binding เช่น click, change และ workflow trigger</p><input className="form-control mb-3" placeholder="Workflow trigger ID" value={draft.actionTriggerId || ''} onChange={(event) => setDraft({ ...draft, actionTriggerId: event.target.value || undefined })}/><textarea className="form-control font-monospace" rows={15} value={eventText} onChange={(event) => setEventText(event.target.value)}/></div>}
    </div>
  </div>;
};
