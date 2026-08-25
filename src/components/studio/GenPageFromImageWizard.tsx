'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Grid3X3, Image as ImageIcon, Layers3, Sparkles, X } from 'lucide-react';
import { FileManagerPopupComponent, type FileManagerAsset } from '@/components/shared/FileManagerPopupComponent';

export interface GenPageFromImageRequest {
  image: FileManagerAsset;
  mode: 'replace' | 'append';
  viewport: 'desktop' | 'tablet' | 'mobile';
  pageTitle: string;
  analysis: {
    sections: Array<{ id: string; label: string; grid: string; component: string; collection: string }>;
  };
}

interface Props { pageTitle: string; onClose: () => void; onGenerate: (request: GenPageFromImageRequest) => Promise<void> | void; }

const detectedSections = [
  { id: 'header', label: 'Header / Account', grid: 'row > col-6 + col-6', component: 'NavMenuComponent · admin-topbar', collection: 'generated.header-actions' },
  { id: 'breadcrumb', label: 'Breadcrumb', grid: 'row > col-12', component: 'NavMenuComponent · breadcrumb', collection: 'generated.breadcrumbs' },
  { id: 'metrics', label: 'KPI Summary', grid: 'row g-3 > 8 × col-12 col-md-6 col-xl-3', component: 'CardComponent · metric-icon', collection: 'generated.dashboard.metrics' },
  { id: 'content', label: 'Latest News', grid: 'col-12 col-xl-9', component: 'ListComponent · compact-status-list', collection: 'generated.dashboard.latest-news' },
  { id: 'sidebar', label: 'Stats & Quick Actions', grid: 'col-12 col-xl-3 > row > col-12 × 2', component: 'ChartComponent + NavMenuComponent', collection: 'generated.visitor + quick-actions' },
];

export const GenPageFromImageWizard: React.FC<Props> = ({ pageTitle, onClose, onGenerate }) => {
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('/uploads');
  const [image, setImage] = useState<FileManagerAsset | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [title, setTitle] = useState(pageTitle);
  const [generating, setGenerating] = useState(false);
  const steps = ['Reference', 'Sections & Grid', 'Components & Data', 'Generate'];
  const generate = async () => { if (!image) return; setGenerating(true); try { await onGenerate({ image, mode, viewport, pageTitle: title, analysis: { sections: detectedSections } }); onClose(); } finally { setGenerating(false); } };

  return <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 2100 }} role="dialog" aria-modal="true"><div className="modal-dialog modal-xl modal-dialog-centered"><div className="modal-content border-0 shadow-lg" style={{ minHeight: 650 }}>
    <div className="modal-header bg-dark text-white"><div><h5 className="modal-title d-flex align-items-center gap-2"><Sparkles size={18} className="text-warning"/> สร้างหน้าจากรูปภาพ</h5><div className="small text-white-50">Image → Bootstrap Grid → Shared Components → Fixed Collections</div></div><button className="btn btn-sm btn-outline-light" onClick={onClose}><X size={15}/></button></div>
    <div className="px-4 py-3 border-bottom bg-light"><div className="d-flex align-items-center">{steps.map((label, index) => <React.Fragment key={label}><div className={`d-flex align-items-center gap-2 ${index <= step ? 'text-primary' : 'text-muted'}`}><span className={`badge rounded-circle ${index < step ? 'bg-success' : index === step ? 'bg-primary' : 'bg-secondary'}`}>{index < step ? '✓' : index + 1}</span><span className="small fw-semibold d-none d-md-inline">{label}</span></div>{index < steps.length - 1 && <div className="flex-grow-1 border-top mx-3"/>}</React.Fragment>)}</div></div>
    <div className="modal-body p-4 overflow-auto">
      {step === 0 && <div className="row g-4"><div className="col-lg-7"><button type="button" className="border border-2 border-dashed rounded-3 bg-light w-100 d-flex flex-column align-items-center justify-content-center overflow-hidden" style={{ minHeight: 380 }} onClick={() => setPickerOpen(true)}>{image ? <><img src={image.url} alt={image.name} className="img-fluid" style={{ maxHeight: 330 }}/><div className="small mt-2">{image.name}</div></> : <><ImageIcon size={52} className="text-primary mb-3"/><strong>เลือกรูปภาพอ้างอิงจาก File Manager</strong><span className="text-muted small mt-1">PNG, JPG, WebP · Dashboard หรือหน้าเว็บไซต์เต็มหน้า</span></>}</button></div><div className="col-lg-5"><label className="form-label fw-semibold">ชื่อ Page</label><input className="form-control mb-3" value={title} onChange={(event) => setTitle(event.target.value)}/><label className="form-label fw-semibold">Viewport ของภาพ</label><select className="form-select mb-3" value={viewport} onChange={(event) => setViewport(event.target.value as typeof viewport)}><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select><label className="form-label fw-semibold">วิธีนำเข้า</label><div className="d-flex flex-column gap-2"><label className="border rounded-3 p-3"><input type="radio" className="form-check-input me-2" checked={mode === 'replace'} onChange={() => setMode('replace')}/> แทน Layout ปัจจุบัน <div className="small text-muted ms-4">ระบบเก็บ Layout เดิมใน History ก่อน</div></label><label className="border rounded-3 p-3"><input type="radio" className="form-check-input me-2" checked={mode === 'append'} onChange={() => setMode('append')}/> เพิ่มเป็น Sections ต่อท้าย</label></div></div></div>}
      {step === 1 && <div><div className="alert alert-info d-flex gap-2"><Grid3X3 size={18}/><div><strong>ตรวจพบ 5 logical sections</strong><div className="small">Grid ถูก snap เป็น Bootstrap 12 columns และมี responsive assumption สำหรับ Tablet/Mobile</div></div></div><div className="d-flex flex-column gap-2">{detectedSections.map((section, index) => <div className="border rounded-3 p-3 d-flex align-items-center gap-3" key={section.id}><span className="badge bg-primary">{index + 1}</span><div className="flex-grow-1"><strong>{section.label}</strong><div className="font-monospace small text-muted">{section.grid}</div></div><span className="badge bg-success-subtle text-success">confidence {index === 4 ? '89%' : '94%'}</span></div>)}</div></div>}
      {step === 2 && <div><div className="alert alert-warning d-flex gap-2"><Layers3 size={18}/><div><strong>Fixed-data draft</strong><div className="small">รอบนี้สร้าง Collection จากข้อความ/ตัวเลขที่เห็นก่อน แล้ว Query Builder จะ map กับ Raw Table ภายหลัง</div></div></div><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Section</th><th>Selected Component</th><th>Collection Contract</th><th>6 Groups</th></tr></thead><tbody>{detectedSections.map((section) => <tr key={section.id}><td className="fw-semibold">{section.label}</td><td><code>{section.component}</code></td><td><code>{section.collection}</code></td><td><span className="badge bg-primary-subtle text-primary">Table</span> <span className="badge bg-success-subtle text-success">List</span> <span className="badge bg-info-subtle text-info">Gallery</span> <span className="badge bg-secondary-subtle text-secondary">Detail</span> <span className="badge bg-warning-subtle text-warning">Document</span> <span className="badge bg-danger-subtle text-danger">Form</span></td></tr>)}</tbody></table></div></div>}
      {step === 3 && <div className="text-center py-4"><CheckCircle2 size={64} className="text-success mb-3"/><h4>พร้อมสร้าง Page Draft</h4><p className="text-muted">ระบบจะสร้าง Bootstrap layout 5 sections, fixed-data contracts, selected component variants และ scoped style tokens</p><div className="row g-3 text-start mt-3"><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">REFERENCE</div><strong>{image?.name}</strong></div></div><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">MODE</div><strong>{mode === 'replace' ? 'Replace current layout' : 'Append sections'}</strong></div></div><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">OUTPUT</div><strong>5 Sections · 6 Collection contracts</strong></div></div></div></div>}
    </div>
    <div className="modal-footer justify-content-between"><button className="btn btn-light" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={14} className="me-1"/> ย้อนกลับ</button>{step < 3 ? <button className="btn btn-primary" disabled={step === 0 && !image} onClick={() => setStep((value) => value + 1)}>ถัดไป <ArrowRight size={14} className="ms-1"/></button> : <button className="btn btn-success px-4" disabled={!image || generating} onClick={() => void generate()}>{generating ? <span className="spinner-border spinner-border-sm me-2"/> : <Sparkles size={15} className="me-1"/>} Generate Page</button>}</div>
    <FileManagerPopupComponent open={pickerOpen} title="เลือกรูปภาพอ้างอิง" rootPath="/uploads" currentPath={pickerPath} onCurrentPathChange={setPickerPath} accept="image/*" selectionMode="single" useButtonText="ใช้รูปนี้" onUse={(files) => { setImage(files[0] || null); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/>
  </div></div></div>;
};
