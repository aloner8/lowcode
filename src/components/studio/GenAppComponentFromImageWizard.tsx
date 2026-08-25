'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Box, CheckCircle2, Grid3X3, Image as ImageIcon, Layers3, Sparkles, X } from 'lucide-react';
import { FileManagerPopupComponent, type FileManagerAsset } from '@/components/shared/FileManagerPopupComponent';

export interface GenAppComponentFromImageRequest {
  image: FileManagerAsset;
  name: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  analysis: { sections: Array<{ id: string; label: string; grid: string; component: string; collection: string }> };
}

const sections = [
  { id: 'header', label: 'Header / Toolbar', grid: 'row > col-12', component: 'DynamicHtmlComponent', collection: 'fixed.header' },
  { id: 'summary', label: 'Summary Cards', grid: 'row g-3 > responsive columns', component: 'CardComponent', collection: 'fixed.metrics' },
  { id: 'content', label: 'Primary Content', grid: 'col-12 col-xl-9', component: 'ListComponent', collection: 'fixed.items' },
  { id: 'aside', label: 'Supporting Content', grid: 'col-12 col-xl-3', component: 'DynamicHtmlComponent', collection: 'fixed.aside' },
];

export const GenAppComponentFromImageWizard: React.FC<{ onClose: () => void; onGenerate: (request: GenAppComponentFromImageRequest) => Promise<void> | void }> = ({ onClose, onGenerate }) => {
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('/uploads');
  const [image, setImage] = useState<FileManagerAsset | null>(null);
  const [name, setName] = useState('Generated App Component');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [generating, setGenerating] = useState(false);
  const labels = ['Reference', 'Grid Analysis', 'Component Contract', 'Generate'];
  const generate = async () => { if (!image || !name.trim()) return; setGenerating(true); try { await onGenerate({ image, name: name.trim(), viewport, analysis: { sections } }); onClose(); } finally { setGenerating(false); } };
  return <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 2300 }} role="dialog" aria-modal="true"><div className="modal-dialog modal-xl modal-dialog-centered"><div className="modal-content border-0 shadow-lg" style={{ minHeight: 620 }}>
    <div className="modal-header bg-dark text-white"><div><h5 className="modal-title d-flex align-items-center gap-2"><Box size={18} className="text-success"/> สร้าง AppComponent จากรูปภาพ</h5><div className="small text-white-50">Reusable Component → Fixed Collection → Drag to any Page</div></div><button className="btn btn-sm btn-outline-light" onClick={onClose}><X size={15}/></button></div>
    <div className="px-4 py-3 border-bottom bg-light d-flex align-items-center">{labels.map((label,index) => <React.Fragment key={label}><div className={`d-flex align-items-center gap-2 ${index <= step ? 'text-success' : 'text-muted'}`}><span className={`badge rounded-circle ${index < step ? 'bg-success' : index === step ? 'bg-primary' : 'bg-secondary'}`}>{index < step ? '✓' : index + 1}</span><span className="small fw-semibold d-none d-md-inline">{label}</span></div>{index < labels.length - 1 && <div className="flex-grow-1 border-top mx-3"/>}</React.Fragment>)}</div>
    <div className="modal-body p-4 overflow-auto">
      {step === 0 && <div className="row g-4"><div className="col-lg-7"><button className="border border-2 border-dashed rounded-3 bg-light w-100 d-flex flex-column align-items-center justify-content-center overflow-hidden" style={{ minHeight: 360 }} onClick={() => setPickerOpen(true)}>{image ? <><img src={image.url} alt={image.name} className="img-fluid" style={{ maxHeight: 310 }}/><small className="mt-2">{image.name}</small></> : <><ImageIcon size={52} className="text-success mb-3"/><strong>เลือกรูปต้นแบบจาก File Manager</strong><small className="text-muted">ไฟล์จริงภายใต้ /uploads</small></>}</button></div><div className="col-lg-5"><label className="form-label fw-semibold">ชื่อ AppComponent</label><input className="form-control mb-3" value={name} onChange={(event) => setName(event.target.value)}/><label className="form-label fw-semibold">Viewport ต้นฉบับ</label><select className="form-select" value={viewport} onChange={(event) => setViewport(event.target.value as typeof viewport)}><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select><div className="alert alert-success small mt-4">ผลลัพธ์จะถูกบันทึกเป็น Collection Component กลาง สามารถลากไปวางใน Page ใดก็ได้</div></div></div>}
      {step === 1 && <div><div className="alert alert-info d-flex gap-2"><Grid3X3 size={18}/><div><b>Bootstrap 12-column analysis</b><div className="small">แบ่งโครงสร้างกว้างก่อน แล้วจึงวิเคราะห์ row, column และ responsive breakpoint</div></div></div>{sections.map((section,index) => <div className="border rounded-3 p-3 mb-2 d-flex gap-3" key={section.id}><span className="badge bg-primary">{index + 1}</span><div><b>{section.label}</b><div className="small font-monospace text-muted">{section.grid}</div></div></div>)}</div>}
      {step === 2 && <div><div className="alert alert-warning d-flex gap-2"><Layers3 size={18}/><div><b>Reusable contract</b><div className="small">ข้อมูลรอบแรกเป็น fixed fields จากภาพ และพร้อมเปลี่ยนไปผูก Query/Raw Table ภายหลัง</div></div></div><table className="table"><thead><tr><th>Section</th><th>Shared Component</th><th>Collection</th></tr></thead><tbody>{sections.map((section) => <tr key={section.id}><td>{section.label}</td><td><code>{section.component}</code></td><td><code>{section.collection}</code></td></tr>)}</tbody></table></div>}
      {step === 3 && <div className="text-center py-5"><CheckCircle2 size={64} className="text-success mb-3"/><h4>พร้อมสร้าง AppComponent</h4><p className="text-muted">สร้าง Collection + Component variant + scoped styles และเปิดใน Component Studio หลังบันทึก</p><strong>{name}</strong></div>}
    </div>
    <div className="modal-footer justify-content-between"><button className="btn btn-light" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={14}/> ย้อนกลับ</button>{step < 3 ? <button className="btn btn-primary" disabled={(step === 0 && !image) || !name.trim()} onClick={() => setStep((value) => value + 1)}>ถัดไป <ArrowRight size={14}/></button> : <button className="btn btn-success px-4" disabled={generating || !image} onClick={() => void generate()}>{generating ? <span className="spinner-border spinner-border-sm me-2"/> : <Sparkles size={14} className="me-1"/>}สร้าง AppComponent</button>}</div>
    <FileManagerPopupComponent open={pickerOpen} title="เลือกรูปต้นแบบ AppComponent" rootPath="/uploads" currentPath={pickerPath} onCurrentPathChange={setPickerPath} accept="image/*" selectionMode="single" useButtonText="ใช้รูปนี้" onUse={(files) => { setImage(files[0] || null); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/>
  </div></div></div>;
};
