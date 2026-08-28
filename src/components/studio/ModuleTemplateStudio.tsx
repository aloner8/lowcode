'use client';

import { useMemo, useState } from 'react';
import { Copy, PackagePlus, Save } from 'lucide-react';

const STORAGE_KEY = 'matchanu:module-templates';
const initialObjects = [
  { type: 'Page', key: 'loginPage', name: '{{moduleName}} Login', route: '{{basePath}}/login' },
  { type: 'API', key: 'checkAuthApi', name: 'CheckAuth', route: '{{apiPrefix}}/auth/check' },
  { type: 'Flow', key: 'loginFlow', name: '{{moduleName}} Login Flow', connects: ['loginPage', 'checkAuthApi'] },
];

export default function ModuleTemplateStudio() {
  const [templateName, setTemplateName] = useState('Module Auth');
  const [instanceName, setInstanceName] = useState('Customer Auth');
  const [moduleName, setModuleName] = useState('Auth');
  const [basePath, setBasePath] = useState('/auth');
  const [apiPrefix, setApiPrefix] = useState('/api/v1');
  const [objects, setObjects] = useState(initialObjects);
  const [status, setStatus] = useState('');

  const instance = useMemo(() => {
    const replace = (value: unknown): unknown => typeof value === 'string'
      ? value.replaceAll('{{moduleName}}', moduleName).replaceAll('{{basePath}}', basePath).replaceAll('{{apiPrefix}}', apiPrefix)
      : Array.isArray(value) ? value.map(replace)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)])) : value;
    return { id: 'module-instance-preview', name: instanceName, template: templateName, parameters: { moduleName, basePath, apiPrefix }, objects: replace(objects) };
  }, [apiPrefix, basePath, instanceName, moduleName, objects, templateName]);

  const save = () => {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: crypto.randomUUID(), name: templateName, parameters: ['moduleName', 'basePath', 'apiPrefix'], objects }, ...current]));
    setStatus(`บันทึก “${templateName}” เป็น Module แม่แบบแล้ว`);
  };

  const clone = () => {
    navigator.clipboard?.writeText(JSON.stringify({ ...instance, id: crypto.randomUUID() }, null, 2));
    setStatus(`Clone Module เป็น “${instanceName}” แล้ว และคัดลอก Object Graph ไว้ใน Clipboard`);
  };

  return <div className="container-fluid py-4">
    <div className="d-flex align-items-start justify-content-between mb-4"><div><h2>ออกแบบ Module</h2><p className="text-secondary mb-0">รวม Page, API, Flow และ Object ที่ทำงานสัมพันธ์กันไว้ในแม่แบบเดียว แล้ว clone ด้วย Parameters</p></div><span className="badge text-bg-primary">Module Template</span></div>
    {status && <div className="alert alert-success py-2">{status}</div>}
    <div className="row g-3">
      <div className="col-lg-4"><div className="card h-100"><div className="card-body"><h5><PackagePlus size={18} className="me-2" />แม่แบบ Module</h5><label className="form-label">ชื่อแม่แบบ</label><input className="form-control mb-3" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><label className="form-label">Object Graph</label><textarea className="form-control font-monospace" rows={16} value={JSON.stringify(objects, null, 2)} onChange={(event) => { try { setObjects(JSON.parse(event.target.value)); } catch { /* keep last valid graph */ } }} /><button className="btn btn-primary w-100 mt-3" onClick={save}><Save size={15} className="me-2" />บันทึกลงแม่แบบ</button></div></div></div>
      <div className="col-lg-4"><div className="card h-100"><div className="card-body"><h5>Parameters ตอน Clone</h5><label className="form-label">ชื่อ Module ใหม่</label><input className="form-control mb-3" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} /><label className="form-label">moduleName</label><input className="form-control mb-3" value={moduleName} onChange={(event) => setModuleName(event.target.value)} /><label className="form-label">basePath</label><input className="form-control mb-3" value={basePath} onChange={(event) => setBasePath(event.target.value)} /><label className="form-label">apiPrefix</label><input className="form-control mb-3" value={apiPrefix} onChange={(event) => setApiPrefix(event.target.value)} /><button className="btn btn-success w-100" onClick={clone}><Copy size={15} className="me-2" />Clone Module</button></div></div></div>
      <div className="col-lg-4"><div className="card h-100"><div className="card-header">Object ที่จะถูกสร้าง</div><div className="card-body p-0"><pre className="p-3 mb-0 overflow-auto" style={{ maxHeight: 620 }}>{JSON.stringify(instance, null, 2)}</pre></div></div></div>
    </div>
  </div>;
}
