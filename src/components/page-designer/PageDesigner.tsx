'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Box, Edit3, FileText, Layers, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import { DynamicPageRenderer } from '@/components/engine/DynamicPageRenderer';
import { GenPageFromImageWizard, type GenPageFromImageRequest } from '@/components/studio/GenPageFromImageWizard';
import { StorageScopeProvider } from '@/components/shared/StorageScopeContext';
import { COMPONENT_PALETTE, type ComponentPaletteItem } from '@/lib/engine/ComponentRegistry';
import type { AppConfig, ComponentNode } from '@/types';

type Page = { id: string; name: string; title: string; routePath?: string; templateType?: string; containerName?: string; isDefaultPage?: boolean; componentTree?: ComponentNode[]; layoutRegions?: Record<string, boolean> };
type PlatformData = { id: string; platformName: string; platformSlug: string; masterThemeConfig: AppConfig['themeConfig']; studioLayout: ComponentNode[]; studioPages: Page[] };

const WORKSPACES: Record<string, { title: string; terms: string[] }> = {
  'public-home': { title: 'Public Home', terms: ['public', 'home', 'landing', 'index'] },
  dashboard: { title: 'Dashboard', terms: ['dashboard', 'summary', 'metric'] },
  'master-detail': { title: 'Form Master Detail', terms: ['master', 'detail', 'form', 'crud'] },
  'admin-page': { title: 'Admin Page', terms: ['admin', 'backend', 'manage'] },
  diagram: { title: 'Diagram', terms: ['diagram', 'flow', 'chart'] },
  calendar: { title: 'Calendar', terms: ['calendar', 'schedule', 'event'] },
};
const REGIONS = [['top', 'Top'], ['sidebar-left', 'Sidebar Left'], ['content', 'Content'], ['sidebar-right', 'Sidebar Right'], ['footer', 'Footer']] as const;

export default function PageDesigner({ workspace }: { readonly workspace: string }) {
  const definition = WORKSPACES[workspace] ?? WORKSPACES['public-home'];
  const [platform, setPlatform] = useState<PlatformData | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ComponentNode[]>([]);
  const [region, setRegion] = useState<string>('content');
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [regionEnabled, setRegionEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(REGIONS.map(([id]) => [id, true])));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [showImageWizard, setShowImageWizard] = useState(false);
  const [status, setStatus] = useState('กำลังโหลด Platform...');

  useEffect(() => {
    const load = async () => {
      try {
        const listResponse = await fetch('/api/platforms', { cache: 'no-store' });
        const listData = await listResponse.json() as { platforms?: Array<{ id: string }>; error?: string };
        if (!listResponse.ok) throw new Error(listData.error || 'อ่านรายการ Platform ไม่สำเร็จ');
        const last = localStorage.getItem('matchanu:last-studio-platform-id');
        const platformId = listData.platforms?.find((item) => item.id === last)?.id ?? listData.platforms?.[0]?.id;
        if (!platformId) throw new Error('ไม่พบ Platform ที่มีสิทธิ์ใช้งาน');
        const response = await fetch(`/api/platforms/${platformId}/studio`, { cache: 'no-store' });
        const data = await response.json() as { platform?: PlatformData; error?: string };
        if (!response.ok || !data.platform) throw new Error(data.error || 'โหลดข้อมูล Page ไม่สำเร็จ');
        setPlatform(data.platform); setPages(data.platform.studioPages || []);
        const shareResponse = await fetch(`/api/file-manager?platformId=${encodeURIComponent(data.platform.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-directory', path: '/uploads', name: 'Share' }) });
        if (!shareResponse.ok) { const shareData = await shareResponse.json() as { error?: string }; throw new Error(shareData.error || 'สร้างโฟลเดอร์ Share ไม่สำเร็จ'); }
        setStatus('');
      } catch (error) { setStatus(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'); }
    };
    void load();
  }, []);

  const filteredPages = useMemo(() => pages.filter((page) => {
    const text = `${page.id} ${page.name} ${page.title} ${page.routePath || ''} ${page.templateType || ''}`.toLowerCase();
    return definition.terms.some((term) => text.includes(term));
  }), [definition.terms, pages]);
  const palette = useMemo(() => COMPONENT_PALETTE.filter((item) => `${item.label} ${item.category} ${item.description}`.toLowerCase().includes(componentSearch.toLowerCase())), [componentSearch]);

  const edit = (page: Page) => {
    setEditingId(page.id); setNodes(page.componentTree || []); setSelectedNodeId(null);
    setRegionEnabled(Object.fromEntries(REGIONS.map(([id]) => [id, page.layoutRegions?.[id] !== false])));
  };
  const createPage = () => {
    const id = `${workspace}-${Date.now().toString(36)}`;
    const page: Page = { id, name: `${definition.title} (${id}.page)`, title: `${definition.title} ใหม่`, routePath: `/${id}`, templateType: workspace, componentTree: [], layoutRegions: Object.fromEntries(REGIONS.map(([regionId]) => [regionId, true])) };
    setPages((current) => [...current, page]); edit(page);
  };
  const createPageFromImage = async (request: GenPageFromImageRequest) => {
    if (!platform) throw new Error('ยังโหลด Platform ไม่สำเร็จ');
    const createdAt = Date.now();
    const layoutFor = (sectionId: string) => sectionId === 'header' || sectionId === 'breadcrumb' ? 'top' : sectionId === 'sidebar' ? 'sidebar-right' : sectionId === 'footer' ? 'footer' : 'content';
    const generatedNodes: ComponentNode[] = request.analysis.sections.map((section, index) => {
      const layoutRegion = layoutFor(section.id);
      const crop = section.crop;
      const cropPreview = crop
        ? `<div class="border rounded overflow-hidden" style="height:240px;background-image:url('${request.image.url}');background-repeat:no-repeat;background-size:${10000 / crop.width}% ${10000 / crop.height}%;background-position:${crop.x / Math.max(100 - crop.width, 1) * 100}% ${crop.y / Math.max(100 - crop.height, 1) * 100}%"></div>`
        : '';
      return {
        id: `image_${section.id}_${createdAt}_${index}`,
        type: 'DynamicHtmlComponent',
        label: `${section.label} · Generated from Image`,
        props: {
          __layoutRegion: layoutRegion, __sectionId: layoutRegion, __sectionName: REGIONS.find(([id]) => id === layoutRegion)?.[1],
          componentRole: 'GeneratedFromImageSection', sourceImageUrl: request.image.url, sourceImagePath: request.image.path,
          viewport: request.viewport, detectedGrid: section.grid, suggestedComponent: section.component, collection: section.collection, sourceCrop: crop,
          content: `<section class="p-4 border rounded-3 bg-white"><div class="small text-primary fw-semibold">Generated from image${crop ? ' · Custom Mark' : ''}</div><h2>${section.label}</h2>${cropPreview}<p class="text-secondary mt-2 mb-0">${section.grid} · ${section.component}</p></section>`,
        },
      };
    });
    const id = `${workspace}-image-${createdAt.toString(36)}`;
    const usedRegions = new Set(generatedNodes.map((node) => String(node.props?.__layoutRegion)));
    const page: Page = { id, name: `${request.pageTitle} (${id}.page)`, title: request.pageTitle, routePath: `/${id}`, templateType: `${workspace}-generated-from-image`, componentTree: generatedNodes, layoutRegions: Object.fromEntries(REGIONS.map(([regionId]) => [regionId, usedRegions.has(regionId)])) };
    const nextPages = [...pages, page];
    setStatus('กำลังสร้าง Page จากรูปภาพ...');
    const response = await fetch(`/api/platforms/${platform.id}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: generatedNodes, studioPages: nextPages }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setStatus(data.error || 'สร้าง Page จากรูปภาพไม่สำเร็จ'); throw new Error(data.error || 'สร้าง Page จากรูปภาพไม่สำเร็จ'); }
    setPages(nextPages); setStatus('สร้าง Page จากรูปภาพและจัดวาง Layout แล้ว'); edit(page);
  };
  const addComponent = (item: ComponentPaletteItem) => {
    const node: ComponentNode = { id: `${item.type}_${Date.now().toString(36)}`, type: item.type, label: item.label, props: { ...structuredClone(item.defaultProps), __layoutRegion: region, __sectionId: region, __sectionName: REGIONS.find(([id]) => id === region)?.[1] || region } };
    setNodes((current) => [...current, node]); setSelectedNodeId(node.id);
  };
  const save = async () => {
    if (!platform || !editingId) return;
    setStatus('กำลังบันทึก...');
    const nextPages = pages.map((page) => page.id === editingId ? { ...page, componentTree: nodes, layoutRegions: regionEnabled, templateType: page.templateType || workspace } : page);
    const response = await fetch(`/api/platforms/${platform.id}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages: nextPages }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setStatus(data.error || 'บันทึกไม่สำเร็จ');
    setPages(nextPages); setStatus('บันทึก Page แล้ว');
  };

  if (!editingId) return <StorageScopeProvider scope={{ platformId: platform?.id }}><><div className="p-3 p-md-4 bg-light min-vh-100">
    <div className="d-flex justify-content-between align-items-start gap-3 mb-4"><div><div className="text-primary small fw-semibold">Page Designer ตัวใหม่</div><h2>{definition.title}</h2><p className="text-secondary mb-0">เลือก Page เพื่อแก้ไขโดยไม่ผ่าน DevStudio Explorer</p></div><div className="d-flex gap-2"><button className="btn btn-outline-primary" onClick={() => setShowImageWizard(true)}><Sparkles size={16} className="me-2"/>สร้าง Page ใหม่จากรูปภาพ</button><button className="btn btn-primary" onClick={createPage}><Plus size={16} className="me-2"/>สร้าง Page</button></div></div>
    {status && <div className={`alert ${platform ? 'alert-info' : 'alert-warning'}`}>{status}</div>}
    <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead className="table-light"><tr><th>Page</th><th>Route</th><th>Template</th><th className="text-end">จัดการ</th></tr></thead><tbody>
      {filteredPages.map((page) => <tr key={page.id}><td><FileText size={16} className="text-primary me-2"/><b>{page.title}</b><div><code>{page.id}</code></div></td><td><code>{page.routePath || `/${page.id}`}</code></td><td>{page.templateType || 'custom'}</td><td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => edit(page)}><Edit3 size={14} className="me-1"/>Edit</button></td></tr>)}
      {!status && filteredPages.length === 0 && <tr><td colSpan={4} className="text-center text-secondary py-5">ยังไม่มี Page ประเภท {definition.title}</td></tr>}
    </tbody></table></div></div>
  </div>{showImageWizard && <GenPageFromImageWizard pageTitle={`${definition.title} จากรูปภาพ`} initialPickerPath="/uploads/Share" onClose={() => setShowImageWizard(false)} onGenerate={createPageFromImage}/>}</></StorageScopeProvider>;

  const currentPage = pages.find((page) => page.id === editingId);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  return <StorageScopeProvider scope={{ platformId: platform?.id }}><><div className="d-flex flex-column bg-light" style={{ minHeight: 'calc(100vh - 64px)' }}>
    <div className="d-flex align-items-center gap-2 px-3 py-2 bg-white border-bottom"><button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}><ArrowLeft size={15}/> กลับรายการ</button><div className="ms-2"><b>{currentPage?.title}</b><div className="small text-secondary">Page Designer · {definition.title}</div></div><span className="ms-auto small text-success">{status}</span><button className="btn btn-sm btn-outline-primary d-flex align-items-center" disabled={!platform} onClick={() => setShowImageWizard(true)}><Sparkles size={15} className="me-1"/>สร้างหน้าจากรูปภาพ</button><button className="btn btn-sm btn-success" onClick={() => void save()}><Save size={15} className="me-1"/>บันทึก</button></div>
    <div className="d-grid flex-grow-1" style={{ gridTemplateColumns: '250px minmax(0,1fr) 300px', minHeight: 0 }}>
      <aside className="bg-white border-end p-3 overflow-auto">
        <div className="d-flex align-items-center gap-2 fw-bold mb-3"><Layers size={17} className="text-warning"/>Layout Outline</div>
        {REGIONS.map(([id, label], index) => {
          const count = nodes.filter((node) => String(node.props?.__layoutRegion || node.props?.__sectionId || 'content') === id).length;
          const enabled = regionEnabled[id] !== false;
          return <div key={id} className={`d-flex align-items-center rounded mb-1 ${region === id ? 'bg-primary text-white' : 'bg-light'} ${enabled ? '' : 'opacity-50'}`}>
            <input type="checkbox" className="form-check-input ms-2 mt-0" checked={enabled} aria-label={`ใช้ Layout ${label}`} onChange={(event) => setRegionEnabled((current) => ({ ...current, [id]: event.target.checked }))}/>
            <button type="button" className={`btn btn-sm border-0 flex-grow-1 d-flex text-start align-items-center ${region === id ? 'text-white' : 'text-dark'}`} onClick={() => { setRegion(id); setSelectedNodeId(null); }}><Box size={12} className="me-2"/>{index + 1}. {label}<span className="badge bg-white text-dark ms-auto">{count}</span></button>
          </div>;
        })}
        <hr/><div className="small fw-semibold mb-2">Object ใน {REGIONS.find(([id]) => id === region)?.[1]}</div>
        {selectedNode && <div className="mb-2"><label className="form-label small mb-1">ชื่อ Object</label><input className="form-control form-control-sm" value={selectedNode.label || selectedNode.type} onChange={(event) => setNodes((items) => items.map((item) => item.id === selectedNode.id ? { ...item, label: event.target.value } : item))}/></div>}
        {nodes.filter((node) => String(node.props?.__layoutRegion || node.props?.__sectionId || 'content') === region).map((node) => <div key={node.id} className={`d-flex align-items-center rounded px-2 py-1 mb-1 ${selectedNodeId === node.id ? 'bg-primary text-white' : 'bg-light'}`} onClick={() => setSelectedNodeId(node.id)}><span className="text-truncate small">{node.label || node.type}</span><button type="button" className="btn btn-sm border-0 text-danger ms-auto p-0" aria-label={`ลบ ${node.label || node.type}`} onClick={(event) => { event.stopPropagation(); const objectName = node.label || node.type; if (window.confirm(`ยืนยันการลบ Object “${objectName}” ออกจาก ${REGIONS.find(([id]) => id === region)?.[1]} หรือไม่?`)) { setNodes((items) => items.filter((item) => item.id !== node.id)); if (selectedNodeId === node.id) setSelectedNodeId(null); } }}><Trash2 size={12}/></button></div>)}
      </aside>
      <main className="p-3 overflow-auto">
        <div className="bg-white rounded shadow-sm mx-auto d-grid overflow-hidden" style={{ minHeight: 650, maxWidth: 1200, gridTemplateColumns: '180px minmax(0,1fr) 180px', gridTemplateRows: 'auto 1fr auto' }}>
          {REGIONS.map(([id, label]) => {
            const enabled = regionEnabled[id] !== false;
            const regionNodes = nodes.filter((node) => String(node.props?.__layoutRegion || node.props?.__sectionId || 'content') === id);
            const placement = id === 'top' ? { gridColumn: '1 / 4', gridRow: '1' } : id === 'sidebar-left' ? { gridColumn: '1', gridRow: '2' } : id === 'content' ? { gridColumn: '2', gridRow: '2' } : id === 'sidebar-right' ? { gridColumn: '3', gridRow: '2' } : { gridColumn: '1 / 4', gridRow: '3' };
            const focused = region === id;
            const hovered = hoveredRegion === id;
            return <section key={id} onMouseEnter={() => setHoveredRegion(id)} onMouseLeave={() => setHoveredRegion(null)} onClick={() => { setRegion(id); setSelectedNodeId(null); }} style={{ ...placement, minHeight: id === 'content' ? 430 : 90, border: focused ? '2px solid #0d6efd' : hovered ? '2px solid #6ea8fe' : '1px dashed #adb5bd', opacity: focused ? 1 : hovered ? 0.62 : 0.22, cursor: 'pointer', filter: enabled ? undefined : 'grayscale(1)', transition: 'opacity .18s, border-color .18s, box-shadow .18s', boxShadow: hovered && !focused ? 'inset 0 0 0 2px rgba(13,110,253,.12)' : undefined, position: 'relative' }}>
              <span className={`position-absolute badge ${focused ? 'text-bg-primary' : 'text-bg-secondary'}`} style={{ zIndex: 3, top: 4, left: 4 }}>{label}{enabled ? '' : ' · ไม่ใช้'}</span>
              <div style={{ pointerEvents: focused && enabled ? 'auto' : 'none' }}>{enabled && <DynamicPageRenderer nodes={regionNodes} themeConfig={platform?.masterThemeConfig} isDesignMode selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} rootTag={id.includes('sidebar') ? 'aside' : id === 'footer' ? 'section' : 'div'}/>}</div>
            </section>;
          })}
        </div>
      </main>
      <aside className="bg-white border-start p-3 overflow-auto"><div className="fw-bold mb-2">Components</div><div className="small text-secondary mb-3">เพิ่มลงใน {REGIONS.find(([id]) => id === region)?.[1]}</div>{regionEnabled[region] === false && <div className="alert alert-warning py-2 small">Layout นี้ถูกปิดใช้งาน กรุณาเลือก Checkbox ก่อนเพิ่ม Component</div>}<div className="position-relative mb-3"><Search size={14} className="position-absolute" style={{ left: 10, top: 10 }}/><input className="form-control form-control-sm ps-4" placeholder="ค้นหา Component" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)}/></div>{palette.map((item) => <button key={item.type} className="btn btn-light border w-100 text-start mb-2 p-2" disabled={regionEnabled[region] === false} onClick={() => addComponent(item)}><div className="d-flex align-items-center"><Box size={14} className="text-primary me-2"/><b className="small">{item.label}</b><Plus size={13} className="ms-auto"/></div><div className="text-secondary mt-1" style={{ fontSize: '.7rem' }}>{item.category} · {item.description}</div></button>)}</aside>
    </div>
  </div>{showImageWizard && <GenPageFromImageWizard key={`new-image-page-${editingId}`} pageTitle={`${definition.title} จากรูปภาพ`} initialPickerPath="/uploads/Share" onClose={() => setShowImageWizard(false)} onGenerate={createPageFromImage}/>}</></StorageScopeProvider>;
}
