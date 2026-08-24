'use client';

import React, { useState } from 'react';
import { ArrowLeft, Database, LayoutTemplate, Plus, Save, Workflow } from 'lucide-react';

export interface PageSettingsValue {
  layoutType?: string;
  globalCss?: string;
  collectionSources?: string[];
  events?: Array<Record<string, unknown>>;
}

interface PageSettingsWorkspaceProps {
  page: { id: string; name: string; title: string; templateType?: string; settings?: PageSettingsValue };
  collections: Array<{ id: string; name: string; table: string }>;
  onBack: () => void;
  onAddSection: (name: string) => void;
  onSave: (settings: PageSettingsValue) => void;
}

export const PageSettingsWorkspace: React.FC<PageSettingsWorkspaceProps> = ({ page, collections, onBack, onAddSection, onSave }) => {
  const [draft, setDraft] = useState<PageSettingsValue>(() => structuredClone(page.settings || { layoutType: page.templateType || 'custom', globalCss: '', collectionSources: [], events: [] }));
  const [sectionName, setSectionName] = useState('New Section');
  const [eventsText, setEventsText] = useState(() => JSON.stringify(page.settings?.events || [], null, 2));
  const commit = () => { try { onSave({ ...draft, events: JSON.parse(eventsText || '[]') }); } catch { window.alert('Events JSON ไม่ถูกต้อง'); } };
  return <div className="card border-0 shadow-sm h-100 overflow-auto">
    <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between py-2"><div className="d-flex align-items-center gap-2"><button className="btn btn-sm btn-outline-light" onClick={onBack}><ArrowLeft size={14}/></button><div><strong>Page Settings</strong><div className="text-white-50 small">{page.name}</div></div></div><button className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={commit}><Save size={13}/> Save Settings</button></div>
    <div className="card-body p-4"><div className="row g-4">
      <div className="col-lg-6"><div className="border rounded-3 p-3 h-100"><h6 className="d-flex gap-2"><LayoutTemplate size={16}/> Layout Structure</h6><select className="form-select mb-3" value={draft.layoutType || 'custom'} onChange={(event) => setDraft({ ...draft, layoutType: event.target.value })}><option value="custom">Custom Layout</option><option value="single-column">Single Column</option><option value="two-columns">Two Columns</option><option value="sidebar-content">Sidebar + Content</option><option value="dashboard-grid">Dashboard Grid</option></select><div className="input-group"><input className="form-control" value={sectionName} onChange={(event) => setSectionName(event.target.value)}/><button className="btn btn-outline-primary d-flex align-items-center gap-1" onClick={() => { if (sectionName.trim()) onAddSection(sectionName.trim()); }}><Plus size={14}/> Add Section</button></div></div></div>
      <div className="col-lg-6"><div className="border rounded-3 p-3 h-100"><h6 className="d-flex gap-2"><Database size={16}/> Collection Sources</h6><div className="d-flex flex-column gap-2">{collections.map((collection) => <label key={collection.id} className="form-check"><input className="form-check-input" type="checkbox" checked={(draft.collectionSources || []).includes(collection.id)} onChange={(event) => setDraft({ ...draft, collectionSources: event.target.checked ? [...(draft.collectionSources || []), collection.id] : (draft.collectionSources || []).filter((id) => id !== collection.id) })}/><span className="form-check-label">{collection.name} <code>{collection.table}</code></span></label>)}</div></div></div>
      <div className="col-12"><div className="border rounded-3 p-3"><h6>CSS หลักของ Page</h6><textarea className="form-control font-monospace" rows={9} placeholder={`.page-${page.id} {\n  /* page styles */\n}`} value={draft.globalCss || ''} onChange={(event) => setDraft({ ...draft, globalCss: event.target.value })}/></div></div>
      <div className="col-12"><div className="border rounded-3 p-3"><h6 className="d-flex gap-2"><Workflow size={16}/> Page Events</h6><textarea className="form-control font-monospace" rows={8} value={eventsText} onChange={(event) => setEventsText(event.target.value)}/></div></div>
    </div></div>
  </div>;
};

