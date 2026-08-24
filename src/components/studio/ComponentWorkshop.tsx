'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Braces, Database, Palette, Save, Workflow } from 'lucide-react';
import type { ComponentNode } from '@/types';
import type { StudioCollectionDefinition } from '@/lib/studio/backendFormDefinitions';
import type { HtmlStudioDocument, StudioNode } from '@/lib/html-studio';
import { HtmlStudioShell } from '@/components/html-studio';

interface ComponentWorkshopProps {
  pageName: string;
  component: ComponentNode;
  collections: StudioCollectionDefinition[];
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

export const ComponentWorkshop: React.FC<ComponentWorkshopProps> = ({ pageName, component, collections, onBack, onSave }) => {
  const [activeTab, setActiveTab] = useState<'html' | 'collection' | 'style' | 'events'>('html');
  const [draft, setDraft] = useState<ComponentNode>(() => normalizeInstance(component));
  const [styleText, setStyleText] = useState(() => JSON.stringify(component.style || {}, null, 2));
  const [eventText, setEventText] = useState(() => JSON.stringify(component.props?.events || [], null, 2));
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
      onSave({ ...next, templateRef: next.templateRef || `component://${next.type}`, htmlId: next.htmlId || defaultHtmlId(next), style: JSON.parse(styleText || '{}'), props: { ...next.props, events: JSON.parse(eventText || '[]') } });
    } catch { window.alert('Style หรือ Events JSON ไม่ถูกต้อง'); }
  };

  const tabs = [
    { id: 'html' as const, label: 'HTML IDE', icon: <Braces size={13}/> },
    { id: 'collection' as const, label: 'Collection', icon: <Database size={13}/> },
    { id: 'style' as const, label: 'Set Style', icon: <Palette size={13}/> },
    { id: 'events' as const, label: 'Events', icon: <Workflow size={13}/> },
  ];

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
      {activeTab === 'html' && <HtmlStudioShell embedded document={{ ...document, root: document.root.map((node, index) => index === 0 ? { ...node, id: draft.id, componentRef: { ...node.componentRef!, id: draft.type }, attributes: { ...node.attributes, ...draft.props, id: draft.htmlId || defaultHtmlId(draft), 'data-component-instance-id': draft.id } } : node) }} onSave={(nextDocument) => { const next = { ...draft, props: { ...draft.props, workshopDocument: nextDocument } }; setDraft(next); commit(next); }}/>} 
      {activeTab === 'collection' && <div className="p-4"><h5>Collection Source</h5><p className="text-muted small">เลือก collection ที่ component นี้จะอ่านข้อมูล</p><select className="form-select" value={String(draft.props?.collectionId || '')} onChange={(event) => setDraft({ ...draft, props: { ...draft.props, collectionId: event.target.value || undefined, dataSource: event.target.value ? { ...(draft.props?.dataSource || {}), collectionId: event.target.value } : draft.props?.dataSource } })}><option value="">ไม่ผูก Collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name} ({collection.table})</option>)}</select><textarea className="form-control font-monospace mt-3" rows={12} value={JSON.stringify(draft.props?.dataSource || {}, null, 2)} onChange={(event) => { try { setDraft({ ...draft, props: { ...draft.props, dataSource: JSON.parse(event.target.value) } }); } catch { /* keep last valid JSON */ } }}/></div>}
      {activeTab === 'style' && <div className="p-4"><h5>Component Style</h5><p className="text-muted small">กำหนด style เฉพาะ component ด้วย JSON</p><textarea className="form-control font-monospace" rows={18} value={styleText} onChange={(event) => setStyleText(event.target.value)}/></div>}
      {activeTab === 'events' && <div className="p-4"><h5>Component Events</h5><p className="text-muted small">กำหนด event binding เช่น click, change และ workflow trigger</p><input className="form-control mb-3" placeholder="Workflow trigger ID" value={draft.actionTriggerId || ''} onChange={(event) => setDraft({ ...draft, actionTriggerId: event.target.value || undefined })}/><textarea className="form-control font-monospace" rows={15} value={eventText} onChange={(event) => setEventText(event.target.value)}/></div>}
    </div>
  </div>;
};
