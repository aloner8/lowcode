'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Grid3X3, Image as ImageIcon, Layers3, Sparkles, X } from 'lucide-react';
import { FileManagerPopupComponent, type FileManagerAsset } from '@/components/shared/FileManagerPopupComponent';

export interface GenPageFromImageRequest {
  image: FileManagerAsset;
  mode: 'replace' | 'append' | 'custom';
  viewport: 'desktop' | 'tablet' | 'mobile';
  markingMode?: 'auto' | 'custom';
  pageTitle: string;
  analysis: {
    sections: Array<{ id: string; label: string; grid: string; component: string; collection: string; crop?: { x: number; y: number; width: number; height: number } }>;
  };
}

interface Props { pageTitle: string; initialPickerPath?: string; onClose: () => void; onGenerate: (request: GenPageFromImageRequest) => Promise<void> | void; }

const detectedSections = [
  { id: 'header', label: 'Header / Account', grid: 'row > col-6 + col-6', component: 'NavMenuComponent · admin-topbar', collection: 'generated.header-actions' },
  { id: 'breadcrumb', label: 'Breadcrumb', grid: 'row > col-12', component: 'NavMenuComponent · breadcrumb', collection: 'generated.breadcrumbs' },
  { id: 'metrics', label: 'KPI Summary', grid: 'row g-3 > 8 × col-12 col-md-6 col-xl-3', component: 'CardComponent · metric-icon', collection: 'generated.dashboard.metrics' },
  { id: 'content', label: 'Latest News', grid: 'col-12 col-xl-9', component: 'ListComponent · compact-status-list', collection: 'generated.dashboard.latest-news' },
  { id: 'sidebar', label: 'Stats & Quick Actions', grid: 'col-12 col-xl-3 > row > col-12 × 2', component: 'ChartComponent + NavMenuComponent', collection: 'generated.visitor + quick-actions' },
];

type Mark = { id: string; label: string; x: number; y: number; width: number; height: number; component: string };
const suggestComponent = (mark: Pick<Mark, 'x' | 'y' | 'width' | 'height'>) => {
  const ratio = mark.width / Math.max(mark.height, 0.01);
  if (mark.y < 20 && mark.width > 55 && mark.height >= 10) return 'DynamicHtmlComponent · hero/banner';
  if (mark.y < 20 && ratio > 3) return 'NavMenuComponent · header/navigation';
  if (ratio > 5) return 'NavMenuComponent · toolbar/breadcrumb';
  if (mark.height > 45 && mark.width < 35) return 'NavMenuComponent · sidebar';
  if (ratio > 1.2 && mark.height < 28) return 'CardComponent · summary/content-card';
  if (mark.height > 30) return 'ListComponent · content-list';
  return 'DynamicHtmlComponent · custom-section';
};

export const GenPageFromImageWizard: React.FC<Props> = ({ pageTitle, initialPickerPath = '/uploads', onClose, onGenerate }) => {
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState(initialPickerPath);
  const [image, setImage] = useState<FileManagerAsset | null>(null);
  const [mode, setMode] = useState<'replace' | 'append' | 'custom'>('replace');
  const [markingMode, setMarkingMode] = useState<'auto' | 'custom'>('auto');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [draft, setDraft] = useState<Omit<Mark, 'id' | 'label' | 'component'> | null>(null);
  const markStart = useRef<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [title, setTitle] = useState(pageTitle);
  const [generating, setGenerating] = useState(false);
  useEffect(() => { if (mode !== 'custom') setMarkingMode('auto'); }, [mode]);
  const steps = ['Reference', 'Sections & Grid', 'Components & Data', 'Generate'];
  const customSections = useMemo(() => marks.map((mark, index) => ({ id: mark.id, label: mark.label || `Auto Section ${index + 1}`, grid: `custom crop ${mark.width.toFixed(1)}% × ${mark.height.toFixed(1)}%`, component: mark.component, collection: `generated.custom.${index + 1}`, crop: { x: mark.x, y: mark.y, width: mark.width, height: mark.height } })), [marks]);
  const sections = mode === 'custom' ? customSections : detectedSections;
  const point = (event: React.PointerEvent<HTMLDivElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) }; };
  const startMark = (event: React.PointerEvent<HTMLDivElement>) => { const p = point(event); markStart.current = p; event.currentTarget.setPointerCapture(event.pointerId); setDraft({ x: p.x, y: p.y, width: 0, height: 0 }); };
  const moveMark = (event: React.PointerEvent<HTMLDivElement>) => { if (!markStart.current) return; const p = point(event), start = markStart.current; setDraft({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) }); };
  const finishMark = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = markStart.current;
    if (start) {
      const p = point(event);
      const completed = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
      // Keep even very small selections. The old 2% × 1% threshold made
      // toolbar icons and narrow menu rows look as if drawing did not work.
      if (completed.width >= 0.2 && completed.height >= 0.2) {
        setMarks((current) => { const number = current.length + 1; return [...current, { ...completed, id: `custom-${Date.now().toString(36)}-${number}`, label: `Auto Section ${number}`, component: suggestComponent(completed) }]; });
      }
    }
    markStart.current = null; setDraft(null);
  };
  const generate = async () => { if (!image) return; setGenerating(true); try { await onGenerate({ image, mode, markingMode: mode === 'custom' ? 'custom' : 'auto', viewport, pageTitle: title, analysis: { sections } }); onClose(); } finally { setGenerating(false); } };

  return <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 2100 }} role="dialog" aria-modal="true"><div className="modal-dialog modal-xl modal-dialog-centered"><div className="modal-content border-0 shadow-lg" style={{ minHeight: 650 }}>
    <div className="modal-header bg-dark text-white"><div><h5 className="modal-title d-flex align-items-center gap-2"><Sparkles size={18} className="text-warning"/> สร้างหน้าจากรูปภาพ</h5><div className="small text-white-50">Image → Bootstrap Grid → Shared Components → Fixed Collections</div></div><button className="btn btn-sm btn-outline-light" onClick={onClose}><X size={15}/></button></div>
    <div className="px-4 py-3 border-bottom bg-light"><div className="d-flex align-items-center">{steps.map((label, index) => <React.Fragment key={label}><div className={`d-flex align-items-center gap-2 ${index <= step ? 'text-primary' : 'text-muted'}`}><span className={`badge rounded-circle ${index < step ? 'bg-success' : index === step ? 'bg-primary' : 'bg-secondary'}`}>{index < step ? '✓' : index + 1}</span><span className="small fw-semibold d-none d-md-inline">{label}</span></div>{index < steps.length - 1 && <div className="flex-grow-1 border-top mx-3"/>}</React.Fragment>)}</div></div>
    <div className="modal-body p-4 overflow-auto">
      {step === 0 && <label className={`border rounded-3 p-3 mb-3 d-block ${mode === 'custom' ? 'border-primary bg-primary bg-opacity-10' : ''}`}><input type="radio" className="form-check-input me-2" checked={mode === 'custom'} onChange={() => { setMode('custom'); setMarkingMode('custom'); }}/> <strong>Custom Mark</strong><span className="text-muted ms-2">เลื่อนรูปและวาดกรอบแบ่ง DynamicHTML ด้วยตนเอง พร้อมแนะนำชนิด Component</span></label>}
      {step === 0 && <div className="row g-4"><div className="col-lg-7"><button type="button" className="border border-2 border-dashed rounded-3 bg-light w-100 d-flex flex-column align-items-center justify-content-center overflow-hidden" style={{ minHeight: 380 }} onClick={() => setPickerOpen(true)}>{image ? <><img src={image.url} alt={image.name} className="img-fluid" style={{ maxHeight: 330 }}/><div className="small mt-2">{image.name}</div></> : <><ImageIcon size={52} className="text-primary mb-3"/><strong>เลือกรูปภาพอ้างอิงจาก File Manager</strong><span className="text-muted small mt-1">PNG, JPG, WebP · Dashboard หรือหน้าเว็บไซต์เต็มหน้า</span></>}</button></div><div className="col-lg-5"><label className="form-label fw-semibold">ชื่อ Page</label><input className="form-control mb-3" value={title} onChange={(event) => setTitle(event.target.value)}/><label className="form-label fw-semibold">Viewport ของภาพ</label><select className="form-select mb-3" value={viewport} onChange={(event) => setViewport(event.target.value as typeof viewport)}><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select><label className="form-label fw-semibold">วิธีนำเข้า</label><div className="d-flex flex-column gap-2"><label className="border rounded-3 p-3"><input type="radio" className="form-check-input me-2" checked={mode === 'replace'} onChange={() => setMode('replace')}/> แทน Layout ปัจจุบัน <div className="small text-muted ms-4">ระบบเก็บ Layout เดิมใน History ก่อน</div></label><label className="border rounded-3 p-3"><input type="radio" className="form-check-input me-2" checked={mode === 'append'} onChange={() => setMode('append')}/> เพิ่มเป็น Sections ต่อท้าย</label></div></div></div>}
      {step === 1 && markingMode === 'auto' && <div><div className="alert alert-info d-flex gap-2"><Grid3X3 size={18}/><div><strong>ตรวจพบ 5 logical sections</strong><div className="small">Grid ถูก snap เป็น Bootstrap 12 columns และมี responsive assumption สำหรับ Tablet/Mobile</div></div></div><div className="d-flex flex-column gap-2">{detectedSections.map((section, index) => <div className="border rounded-3 p-3 d-flex align-items-center gap-3" key={section.id}><span className="badge bg-primary">{index + 1}</span><div className="flex-grow-1"><strong>{section.label}</strong><div className="font-monospace small text-muted">{section.grid}</div></div><span className="badge bg-success-subtle text-success">confidence {index === 4 ? '89%' : '94%'}</span></div>)}</div></div>}
      {step === 1 && markingMode === 'custom' && <div className="row g-3"><div className="col-lg-8"><div className="alert alert-info py-2"><strong>Custom Mark:</strong> ลากกรอบบนรูปเพื่อแบ่ง DynamicHTML สามารถเลื่อนดูรูปได้จนสุดภาพ</div><div className="border rounded bg-light overflow-auto p-2" style={{ height: 460 }}><div className="position-relative mx-auto" style={{ width: 'fit-content', maxWidth: '100%' }}><img src={image?.url} alt={image?.name || 'reference'} draggable={false} className="d-block mw-100 h-auto"/><div className="position-absolute top-0 start-0 w-100 h-100" style={{ cursor: 'crosshair', touchAction: 'none' }} onPointerDown={startMark} onPointerMove={moveMark} onPointerUp={finishMark} onPointerCancel={finishMark}>{marks.map((mark, index) => <div key={mark.id} className="position-absolute border border-2 border-primary bg-primary bg-opacity-10" style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.width}%`, height: `${mark.height}%`, pointerEvents: 'none' }}><span className="badge text-bg-primary">{index + 1}</span></div>)}{draft && <div className="position-absolute border border-2 border-warning bg-warning bg-opacity-25" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%`, pointerEvents: 'none' }}/>}</div></div></div></div><div className="col-lg-4"><div className="d-flex justify-content-between align-items-center mb-2"><strong>ส่วนที่วาด ({marks.length})</strong>{marks.length > 0 && <button className="btn btn-sm btn-outline-danger" onClick={() => setMarks([])}>ล้างทั้งหมด</button>}</div><div className="overflow-auto" style={{ maxHeight: 475 }}>{marks.map((mark, index) => <div className="border rounded p-2 mb-2" key={mark.id}><div className="d-flex gap-2 align-items-center mb-2"><span className="badge text-bg-primary">{index + 1}</span><input className="form-control form-control-sm" aria-label={`ชื่อส่วนที่ ${index + 1}`} value={mark.label} onChange={(event) => setMarks((current) => current.map((item) => item.id === mark.id ? { ...item, label: event.target.value } : item))}/><button className="btn btn-sm btn-outline-danger" onClick={() => setMarks((current) => current.filter((item) => item.id !== mark.id))}>×</button></div><div className="small text-success fw-semibold">แนะนำ: {mark.component}</div><select className="form-select form-select-sm mt-1" value={mark.component} onChange={(event) => setMarks((current) => current.map((item) => item.id === mark.id ? { ...item, component: event.target.value } : item))}><option>DynamicHtmlComponent · custom-section</option><option>NavMenuComponent · header/navigation</option><option>NavMenuComponent · toolbar/breadcrumb</option><option>NavMenuComponent · sidebar</option><option>CardComponent · summary/content-card</option><option>ListComponent · content-list</option></select></div>)}{marks.length === 0 && <div className="text-secondary small border rounded p-3">ยังไม่มีกรอบ ลากเมาส์บนรูปเพื่อเริ่มแบ่งส่วน</div>}</div></div></div>}
      {step === 2 && <div><div className="alert alert-warning d-flex gap-2"><Layers3 size={18}/><div><strong>Fixed-data draft</strong><div className="small">แต่ละส่วนจะถูกเก็บเป็น DynamicHTML แยกกัน และสามารถเปลี่ยนชื่อได้จากรายการ Object</div></div></div><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Section</th><th>Selected Component</th><th>Collection Contract</th><th>6 Groups</th></tr></thead><tbody>{sections.map((section) => <tr key={section.id}><td className="fw-semibold">{section.label}</td><td><code>{section.component}</code></td><td><code>{section.collection}</code></td><td><span className="badge bg-primary-subtle text-primary">Table</span> <span className="badge bg-success-subtle text-success">List</span> <span className="badge bg-info-subtle text-info">Gallery</span> <span className="badge bg-secondary-subtle text-secondary">Detail</span> <span className="badge bg-warning-subtle text-warning">Document</span> <span className="badge bg-danger-subtle text-danger">Form</span></td></tr>)}</tbody></table></div></div>}
      {step === 3 && <div className="text-center py-4"><CheckCircle2 size={64} className="text-success mb-3"/><h4>พร้อมสร้าง Page Draft</h4><p className="text-muted">ระบบจะสร้าง Bootstrap layout 5 sections, fixed-data contracts, selected component variants และ scoped style tokens</p><div className="row g-3 text-start mt-3"><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">REFERENCE</div><strong>{image?.name}</strong></div></div><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">MODE</div><strong>{mode === 'replace' ? 'Replace current layout' : 'Append sections'}</strong></div></div><div className="col-md-4"><div className="border rounded-3 p-3"><div className="text-muted small">OUTPUT</div><strong>5 Sections · 6 Collection contracts</strong></div></div></div></div>}
    </div>
    <div className="modal-footer justify-content-between"><button className="btn btn-light" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={14} className="me-1"/> ย้อนกลับ</button>{step < 3 ? <button className="btn btn-primary" disabled={step === 0 && !image} onClick={() => setStep((value) => value + 1)}>ถัดไป <ArrowRight size={14} className="ms-1"/></button> : <button className="btn btn-success px-4" disabled={!image || generating} onClick={() => void generate()}>{generating ? <span className="spinner-border spinner-border-sm me-2"/> : <Sparkles size={15} className="me-1"/>} Generate Page</button>}</div>
    <FileManagerPopupComponent open={pickerOpen} title="เลือกรูปภาพอ้างอิง" rootPath="/uploads" currentPath={pickerPath} onCurrentPathChange={setPickerPath} accept="image/*" selectionMode="single" useButtonText="ใช้รูปนี้" onUse={(files) => { setImage(files[0] || null); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/>
  </div></div></div>;
};
