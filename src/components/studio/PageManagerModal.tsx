'use client';

import React, { useState } from 'react';
import { FileText, Plus, Copy, Trash2, Star, X } from 'lucide-react';

export interface ManagedPageLayout { id: string; name: string; title: string; templateType?: string; isDefaultPage?: boolean; }
interface Props {
  isOpen: boolean; onClose: () => void; activePageSlug: string; pages: ManagedPageLayout[];
  onSelectPage: (slug: string) => void;
  onCreatePage: (input: { slug: string; title: string; templateType: string }) => Promise<void>;
  onClonePage: (pageId: string) => Promise<void>; onDeletePage: (pageId: string) => Promise<void>; onSetDefaultPage: (pageId: string) => Promise<void>;
}

const TEMPLATES = [
  { value: 'blank_content', label: 'Blank Content' }, { value: 'admin_backend', label: 'Admin Backend (Complete Sidebar)' }, { value: 'municipal_home', label: 'Municipal Home' },
  { value: 'top_nav_content', label: 'Top Navigation + Content' }, { value: 'sidebar_content', label: 'Sidebar + Content' },
  { value: 'dashboard', label: 'Dashboard Starter' },
];

export const PageManagerModal: React.FC<Props> = ({ isOpen, onClose, activePageSlug, pages, onSelectPage, onCreatePage, onClonePage, onDeletePage, onSetDefaultPage }) => {
  const [slug, setSlug] = useState(''); const [title, setTitle] = useState('');
  const [templateType, setTemplateType] = useState('blank_content'); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return; setBusy(key); setError(null);
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถบันทึกข้อมูลได้'); } finally { setBusy(null); }
  };
  const create = () => void run('create', async () => {
    const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!normalized) throw new Error('กรุณาระบุ Page slug');
    if (pages.some((page) => page.id.toLowerCase() === normalized)) throw new Error(`Page /${normalized} มีอยู่แล้ว`);
    await onCreatePage({ slug: normalized, title: title.trim() || `${normalized.toUpperCase()} Page`, templateType }); setSlug(''); setTitle('');
  });

  return <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center z-3 select-none" style={{ background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)' }}>
    <div className="card shadow-lg border-0 rounded-3 bg-white overflow-hidden w-100 animate-fadeIn" style={{ maxWidth: 820 }}>
      <div className="card-header border-0 text-white p-3.5 d-flex align-items-center justify-content-between" style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#31104b 50%,#4c1d95 100%)' }}>
        <div className="d-flex align-items-center gap-2.5"><FileText size={22} /><div><h5 className="fw-bold mb-0 text-white">Solution Page Layout Manager</h5><div className="text-white-50 extra-small">Manage page layouts and save changes to Platform database</div></div></div>
        <button className="btn btn-sm btn-outline-light border-0 rounded-circle p-1" onClick={onClose} disabled={Boolean(busy)}><X size={18} /></button>
      </div>
      <div className="card-body p-4">
        <div className="p-3 bg-light rounded-3 border mb-3">
          <h6 className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1.5"><Plus size={15} className="text-primary" /> Create New Page Layout</h6>
          <div className="row g-2">
            <div className="col-md-3"><input className="form-control form-control-sm bg-white extra-small" placeholder="Page slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={Boolean(busy)} /></div>
            <div className="col-md-3"><input className="form-control form-control-sm bg-white extra-small" placeholder="Page title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={Boolean(busy)} /></div>
            <div className="col-md-4"><select className="form-select form-select-sm bg-white extra-small" value={templateType} onChange={(e) => setTemplateType(e.target.value)} disabled={Boolean(busy)} aria-label="Template layout">{TEMPLATES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div>
            <div className="col-md-2"><button className="btn btn-primary btn-sm w-100 extra-small py-1" onClick={create} disabled={Boolean(busy)}>{busy === 'create' ? 'Saving...' : 'Add'}</button></div>
          </div>{error && <div className="text-danger extra-small mt-2">{error}</div>}
        </div>
        <div className="d-flex flex-column gap-2" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {pages.map((page) => { const active = page.id === activePageSlug; return <div key={page.id} className={`p-2.5 rounded-3 border d-flex align-items-center justify-content-between transition ${active ? 'bg-primary bg-opacity-10 border-primary shadow-xs' : 'bg-white hover-bg-light'}`}>
            <div className="d-flex align-items-center gap-2.5"><FileText size={18} className={active ? 'text-primary' : 'text-secondary'} /><div><div className="fw-bold text-dark small d-flex align-items-center gap-2 flex-wrap"><span>{page.title}</span><code>/{page.id}</code>{page.isDefaultPage && <span className="badge bg-warning text-dark extra-small d-flex align-items-center gap-1"><Star size={10} className="fill-dark" /> Start Page</span>}</div><div className="text-secondary extra-small">{TEMPLATES.find((item) => item.value === page.templateType)?.label || page.templateType || 'Legacy / not selected'}</div></div></div>
            <div className="d-flex align-items-center gap-1">
              {!page.isDefaultPage && <button className="btn btn-sm btn-outline-warning extra-small py-0.5 px-2" onClick={() => void run(`default-${page.id}`, () => onSetDefaultPage(page.id))} disabled={Boolean(busy)}>Set Start Page</button>}
              <button className={`btn btn-sm py-0.5 px-2.5 extra-small fw-semibold ${active ? 'btn-primary text-white shadow-sm' : 'btn-outline-primary'}`} onClick={() => { onSelectPage(page.id); onClose(); }} disabled={Boolean(busy)}>{active ? 'Active' : 'Open'}</button>
              <button className="btn btn-sm btn-outline-secondary py-0.5 px-1.5" onClick={() => void run(`clone-${page.id}`, () => onClonePage(page.id))} title="Clone Page" disabled={Boolean(busy)}><Copy size={12} /></button>
              {pages.length > 1 && <button className="btn btn-sm btn-outline-danger py-0.5 px-1.5" onClick={() => void run(`delete-${page.id}`, () => onDeletePage(page.id))} title={page.isDefaultPage ? 'Set another Start Page before deleting' : 'Delete Page'} disabled={Boolean(busy) || page.isDefaultPage}><Trash2 size={12} /></button>}
            </div>
          </div>; })}
        </div>
      </div>
      <div className="card-footer bg-light border-top p-3 px-4 text-end"><button className="btn btn-secondary btn-sm px-4 extra-small" onClick={onClose} disabled={Boolean(busy)}>Close Manager</button></div>
    </div>
  </div>;
};
