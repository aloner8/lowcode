'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Save, Sparkles } from 'lucide-react';

type Parameter = { key: string; label: string; defaultValue: string };
type SavedTemplate = { id: string; name: string; kind: string; parameters: Parameter[]; source: string; savedAt: string };

const STORAGE_KEY = 'matchanu:central-object-templates';

export default function ParameterizedObjectStudio({ kind, title, description }: {
  readonly kind: string;
  readonly title: string;
  readonly description: string;
}) {
  const [name, setName] = useState(`${title} Template`);
  const [cloneName, setCloneName] = useState(`${title} Instance`);
  const [parameters, setParameters] = useState<Parameter[]>([
    { key: 'primaryColor', label: 'สีหลัก', defaultValue: '#0b5cab' },
    { key: 'label', label: 'ข้อความ', defaultValue: title },
  ]);
  const [source, setSource] = useState('<svg viewBox="0 0 320 120"><rect width="320" height="120" rx="18" fill="{{primaryColor}}"/><text x="160" y="68" text-anchor="middle" fill="white" font-size="22">{{label}}</text></svg>');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { setSaved([]); }
  }, []);

  const rendered = useMemo(() => parameters.reduce(
    (result, parameter) => result.replaceAll(`{{${parameter.key}}}`, values[parameter.key] ?? parameter.defaultValue),
    source,
  ), [parameters, source, values]);

  const persist = (items: SavedTemplate[]) => {
    setSaved(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const saveTemplate = () => {
    const item: SavedTemplate = { id: crypto.randomUUID(), name: name.trim() || title, kind, parameters, source, savedAt: new Date().toISOString() };
    persist([item, ...saved]);
    setStatus(`บันทึก “${item.name}” ลงแม่แบบส่วนกลางแล้ว`);
  };

  const cloneObject = () => {
    const object = { id: crypto.randomUUID(), name: cloneName.trim() || `${name} Copy`, templateKind: kind, parameters: Object.fromEntries(parameters.map((parameter) => [parameter.key, values[parameter.key] ?? parameter.defaultValue])), source: rendered };
    navigator.clipboard?.writeText(JSON.stringify(object, null, 2));
    setStatus(`Clone เป็น Object “${object.name}” แล้ว และคัดลอก JSON ไว้ใน Clipboard`);
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
        <div><h2 className="mb-1">{title}</h2><p className="text-secondary mb-0">{description}</p></div>
        <span className="badge text-bg-primary">Parameterized Object</span>
      </div>
      {status && <div className="alert alert-success py-2">{status}</div>}
      <div className="row g-3">
        <div className="col-xl-4">
          <div className="card h-100"><div className="card-body">
            <h5>1. แม่แบบส่วนกลาง</h5>
            <label className="form-label">ชื่อแม่แบบ</label><input className="form-control mb-3" value={name} onChange={(event) => setName(event.target.value)} />
            <label className="form-label">SVG / Object Source</label><textarea className="form-control font-monospace mb-3" rows={10} value={source} onChange={(event) => setSource(event.target.value)} />
            <button className="btn btn-primary w-100" onClick={saveTemplate}><Save size={15} className="me-2" />บันทึกลงแม่แบบ</button>
          </div></div>
        </div>
        <div className="col-xl-4">
          <div className="card h-100"><div className="card-body">
            <h5>2. Parameters</h5>
            {parameters.map((parameter, index) => <div className="border rounded p-2 mb-2" key={`${parameter.key}-${index}`}>
              <input className="form-control form-control-sm mb-2" placeholder="Parameter key" value={parameter.key} onChange={(event) => setParameters((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} />
              <input className="form-control form-control-sm mb-2" placeholder="ชื่อที่แสดง" value={parameter.label} onChange={(event) => setParameters((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
              <input className="form-control form-control-sm" placeholder="ค่าเริ่มต้น" value={parameter.defaultValue} onChange={(event) => setParameters((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, defaultValue: event.target.value } : item))} />
            </div>)}
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setParameters((items) => [...items, { key: `param${items.length + 1}`, label: 'พารามิเตอร์ใหม่', defaultValue: '' }])}>+ เพิ่ม Parameter</button>
          </div></div>
        </div>
        <div className="col-xl-4">
          <div className="card h-100"><div className="card-body">
            <h5>3. Clone Object</h5>
            <label className="form-label">ชื่อ Object ใหม่</label><input className="form-control mb-3" value={cloneName} onChange={(event) => setCloneName(event.target.value)} />
            {parameters.map((parameter) => <div className="mb-2" key={parameter.key}><label className="form-label small">{parameter.label} <code>{parameter.key}</code></label><input className="form-control" value={values[parameter.key] ?? parameter.defaultValue} onChange={(event) => setValues((current) => ({ ...current, [parameter.key]: event.target.value }))} /></div>)}
            <button className="btn btn-success w-100 mt-2" onClick={cloneObject}><Copy size={15} className="me-2" />Clone และสร้าง Object</button>
          </div></div>
        </div>
      </div>
      <div className="card mt-3"><div className="card-header d-flex gap-2 align-items-center"><Sparkles size={16} /> Preview</div><div className="card-body bg-light text-center"><iframe title="Object preview" sandbox="" srcDoc={rendered} className="border-0 w-100" style={{ minHeight: 180 }} /></div></div>
    </div>
  );
}
