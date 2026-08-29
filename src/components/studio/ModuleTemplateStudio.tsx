'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Globe2, Lock, PackagePlus, Save } from 'lucide-react';

type Platform = { id: string; platformName: string };
type Template = { id: string; name: string; parameters: string[]; objects: unknown[]; isPublic: boolean; isOwner: boolean; ownerName: string };
const defaults = [
  { type: 'Page', key: 'loginPage', name: '{{moduleName}} Login', route: '{{basePath}}/login' },
  { type: 'API', key: 'checkAuthApi', name: 'CheckAuth', route: '{{apiPrefix}}/auth/check' },
  { type: 'Flow', key: 'loginFlow', name: '{{moduleName}} Login Flow', connects: ['loginPage', 'checkAuthApi'] },
];

export default function ModuleTemplateStudio() {
  const [templates, setTemplates] = useState<Template[]>([]), [platforms, setPlatforms] = useState<Platform[]>([]);
  const [templateId, setTemplateId] = useState(''), [platformId, setPlatformId] = useState('');
  const [templateName, setTemplateName] = useState('Module Auth'), [instanceName, setInstanceName] = useState('Customer Auth');
  const [moduleName, setModuleName] = useState('Auth'), [basePath, setBasePath] = useState('/auth'), [apiPrefix, setApiPrefix] = useState('/api/v1');
  const [isPublic, setIsPublic] = useState(false), [graphText, setGraphText] = useState(JSON.stringify(defaults, null, 2));
  const [status, setStatus] = useState(''), [error, setError] = useState('');

  const load = useCallback(async () => {
    const [tr, pr] = await Promise.all([fetch('/api/module-templates', { cache: 'no-store' }), fetch('/api/platforms', { cache: 'no-store' })]);
    const td = await tr.json(), pd = await pr.json();
    if (!tr.ok) throw new Error(td.error || 'โหลดแม่แบบไม่สำเร็จ');
    if (!pr.ok) throw new Error(pd.error || 'โหลด Platform ไม่สำเร็จ');
    setTemplates(td.templates || []); setPlatforms(pd.platforms || []);
    setTemplateId((value) => value || td.templates?.[0]?.id || ''); setPlatformId((value) => value || pd.platforms?.[0]?.id || '');
  }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);

  const selected = templates.find((item) => item.id === templateId);
  const preview = useMemo(() => {
    const replace = (value: unknown): unknown => typeof value === 'string'
      ? value.replaceAll('{{moduleName}}', moduleName).replaceAll('{{basePath}}', basePath).replaceAll('{{apiPrefix}}', apiPrefix)
      : Array.isArray(value) ? value.map(replace)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)])) : value;
    return { name: instanceName, template: selected?.name ?? templateName, parameters: { moduleName, basePath, apiPrefix }, objects: replace(selected?.objects ?? defaults) };
  }, [apiPrefix, basePath, instanceName, moduleName, selected, templateName]);

  async function save() {
    setError(''); setStatus('');
    try {
      const objects: unknown = JSON.parse(graphText); if (!Array.isArray(objects)) throw new Error('Object Graph ต้องเป็น JSON array');
      const response = await fetch('/api/module-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'template', name: templateName, parameters: ['moduleName', 'basePath', 'apiPrefix'], objects, isPublic }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      await load(); setTemplateId(data.template.id); setStatus(`บันทึก “${templateName}” เป็นแม่แบบ${isPublic ? ' Public' : 'ส่วนตัว'}แล้ว`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ'); }
  }

  async function clone() {
    setError(''); setStatus('');
    if (!templateId || !platformId) return setError('กรุณาเลือกแม่แบบและ Platform ปลายทาง');
    const response = await fetch('/api/module-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'module', platformId, templateId, name: instanceName, parameters: { moduleName, basePath, apiPrefix } }) });
    const data = await response.json(); if (!response.ok) return setError(data.error || 'Clone ไม่สำเร็จ');
    setStatus(`Clone Module เป็น “${instanceName}” ลงใน Platform แล้ว`);
  }

  return <div className="container-fluid py-4">
    <div className="d-flex align-items-start justify-content-between mb-4"><div><h2>ออกแบบ Module</h2><p className="text-secondary mb-0">แม่แบบแยกจากข้อมูล Module ของแต่ละ Platform และแบ่งปันให้ผู้ใช้อื่นได้</p></div><span className="badge text-bg-primary">Module Template</span></div>
    {status && <div className="alert alert-success py-2">{status}</div>}{error && <div className="alert alert-danger py-2">{error}</div>}
    <div className="card mb-3"><div className="card-body"><label className="form-label">คลังแม่แบบ (แม่แบบของฉัน + Public)</label><select className="form-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">-- เลือกแม่แบบ --</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.isOwner ? 'ของฉัน' : item.ownerName} ({item.isPublic ? 'Public' : 'Private'})</option>)}</select></div></div>
    <div className="row g-3">
      <div className="col-lg-4"><div className="card h-100"><div className="card-body"><h5><PackagePlus size={18} className="me-2" />สร้างแม่แบบ Module</h5><label className="form-label">ชื่อแม่แบบ</label><input className="form-control mb-3" value={templateName} onChange={(e) => setTemplateName(e.target.value)} /><div className="form-check form-switch mb-3"><input id="module-public" className="form-check-input" type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /><label className="form-check-label" htmlFor="module-public">{isPublic ? <><Globe2 size={15} className="me-1" />Public — ผู้ใช้ทุกคนมองเห็น</> : <><Lock size={15} className="me-1" />Private — เฉพาะผู้สร้าง</>}</label></div><label className="form-label">Object Graph</label><textarea className="form-control font-monospace" rows={16} value={graphText} onChange={(e) => setGraphText(e.target.value)} /><button className="btn btn-primary w-100 mt-3" onClick={save}><Save size={15} className="me-2" />บันทึกลงตารางแม่แบบ</button></div></div></div>
      <div className="col-lg-4"><div className="card h-100"><div className="card-body"><h5>Parameters ตอน Clone</h5><label className="form-label">Platform ปลายทาง</label><select className="form-select mb-3" value={platformId} onChange={(e) => setPlatformId(e.target.value)}><option value="">-- เลือก Platform --</option>{platforms.map((item) => <option key={item.id} value={item.id}>{item.platformName}</option>)}</select><label className="form-label">ชื่อ Module ใหม่</label><input className="form-control mb-3" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} /><label className="form-label">moduleName</label><input className="form-control mb-3" value={moduleName} onChange={(e) => setModuleName(e.target.value)} /><label className="form-label">basePath</label><input className="form-control mb-3" value={basePath} onChange={(e) => setBasePath(e.target.value)} /><label className="form-label">apiPrefix</label><input className="form-control mb-3" value={apiPrefix} onChange={(e) => setApiPrefix(e.target.value)} /><button className="btn btn-success w-100" onClick={clone}><Copy size={15} className="me-2" />Clone ลงข้อมูล Platform</button></div></div></div>
      <div className="col-lg-4"><div className="card h-100"><div className="card-header">Object ที่จะถูกสร้าง</div><div className="card-body p-0"><pre className="p-3 mb-0 overflow-auto" style={{ maxHeight: 620 }}>{JSON.stringify(preview, null, 2)}</pre></div></div></div>
    </div>
  </div>;
}
