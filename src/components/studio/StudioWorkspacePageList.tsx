'use client';

import { Edit3, FileText, Plus } from 'lucide-react';

const WORKSPACES: Record<string, { title: string; description: string; terms: string[] }> = {
  'public-home': { title: 'Public Home', description: 'หน้าเว็บไซต์สาธารณะและหน้าแรก', terms: ['public', 'home', 'landing', 'index'] },
  dashboard: { title: 'Dashboard', description: 'หน้าสรุปข้อมูล ตัวเลข และตัวชี้วัด', terms: ['dashboard', 'summary', 'metric'] },
  'master-detail': { title: 'Form Master Detail', description: 'หน้าฟอร์มข้อมูลหลักและรายการย่อย', terms: ['master', 'detail', 'form', 'crud'] },
  'admin-page': { title: 'Admin Page', description: 'หน้าจัดการระบบหลังบ้าน', terms: ['admin', 'backend', 'manage'] },
  diagram: { title: 'Diagram', description: 'หน้าแผนภาพและความสัมพันธ์', terms: ['diagram', 'flow', 'chart'] },
  calendar: { title: 'Calendar', description: 'หน้าปฏิทิน กิจกรรม และการนัดหมาย', terms: ['calendar', 'schedule', 'event'] },
};

interface WorkspacePage {
  id: string; name: string; title: string; routePath?: string; templateType?: string;
  containerName?: string; isDefaultPage?: boolean;
}

export function StudioWorkspacePageList({ workspace, pages, loading, onEdit, onCreate }: {
  readonly workspace: string; readonly pages: WorkspacePage[]; readonly loading: boolean;
  readonly onEdit: (pageId: string) => void; readonly onCreate: () => void;
}) {
  const definition = WORKSPACES[workspace] ?? WORKSPACES['public-home'];
  const filtered = pages.filter((page) => {
    const searchable = `${page.id} ${page.name} ${page.title} ${page.routePath ?? ''} ${page.templateType ?? ''}`.toLowerCase();
    return definition.terms.some((term) => searchable.includes(term));
  });

  return <div className="container-fluid p-3 p-md-4 bg-light min-vh-100">
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div><div className="text-primary small fw-semibold mb-1">ออกแบบหน้าเว็บ</div><h2 className="mb-1">{definition.title}</h2><p className="text-secondary mb-0">{definition.description}</p></div>
      <button type="button" className="btn btn-primary" onClick={onCreate}><Plus size={16} className="me-2" />สร้าง Page</button>
    </div>
    <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table table-hover align-middle mb-0">
      <thead className="table-light"><tr><th>Page</th><th>Route</th><th>Layout / Template</th><th>Container</th><th className="text-end">จัดการ</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={5} className="text-center text-secondary py-5">กำลังโหลด Page จากฐานข้อมูล...</td></tr> : filtered.length ? filtered.map((page) => <tr key={page.id}>
        <td><div className="d-flex align-items-center gap-2"><span className="bg-primary bg-opacity-10 text-primary rounded p-2"><FileText size={16} /></span><div><div className="fw-semibold">{page.title || page.name}</div><code className="small">{page.id}</code>{page.isDefaultPage && <span className="badge text-bg-warning ms-2">HOME</span>}</div></div></td>
        <td><code>{page.routePath || `/${page.id}`}</code></td><td>{page.templateType || 'custom'}</td><td>{page.containerName || '-'}</td>
        <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEdit(page.id)}><Edit3 size={14} className="me-1" />Edit</button></td>
      </tr>) : <tr><td colSpan={5} className="text-center py-5"><FileText size={30} className="text-secondary mb-2" /><div className="fw-semibold">ยังไม่มี Page ในประเภท {definition.title}</div><div className="text-secondary small">กด “สร้าง Page” เพื่อเพิ่มรายการแรก</div></td></tr>}</tbody>
    </table></div></div>
  </div>;
}
