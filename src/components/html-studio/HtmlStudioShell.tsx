'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Braces, ChevronRight, Code2, ExternalLink, Eye, LayoutPanelLeft, Monitor, Save, Smartphone, Tablet, Trash2, X } from 'lucide-react';
import { appendNode, cloneDocument, compileDocument, createNodeId, findNode, parseHtmlSource, removeNode, serializeStudioNodes, updateNode, type HtmlStudioDocument, type StudioNode } from '@/lib/html-studio';
import { COMPONENT_REGISTRY } from '@/lib/engine/ComponentRegistry';

interface HtmlStudioShellProps { document: HtmlStudioDocument; onSave: (document: HtmlStudioDocument) => void; onClose?: () => void; embedded?: boolean; onDirtyChange?: (dirty: boolean) => void; openInNewTabUrl?: string; }
type ViewMode = 'visual' | 'split' | 'source';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const LIBRARY: Array<{ label: string; node: () => StudioNode }> = [
  { label: 'Section', node: () => ({ id: createNodeId('section'), kind: 'element', tag: 'section', classList: ['p-4'], children: [] }) },
  { label: 'Container', node: () => ({ id: createNodeId('div'), kind: 'element', tag: 'div', classList: ['container'], children: [] }) },
  { label: 'Heading', node: () => ({ id: createNodeId('heading'), kind: 'element', tag: 'h2', children: [{ id: createNodeId('text'), kind: 'text', text: 'New heading' }] }) },
  { label: 'Paragraph', node: () => ({ id: createNodeId('paragraph'), kind: 'element', tag: 'p', children: [{ id: createNodeId('text'), kind: 'text', text: 'Write your content here.' }] }) },
  { label: 'Button', node: () => ({ id: createNodeId('button'), kind: 'element', tag: 'button', classList: ['btn', 'btn-primary'], attributes: { type: 'button' }, children: [{ id: createNodeId('text'), kind: 'text', text: 'Action' }] }) },
  { label: 'Image', node: () => ({ id: createNodeId('image'), kind: 'element', tag: 'img', classList: ['img-fluid'], attributes: { src: '/placeholder.svg', alt: 'Image description', loading: 'lazy' } }) },
  { label: 'Shared Card', node: () => ({ id: createNodeId('shared'), kind: 'component', componentRef: { id: 'CardComponent', scope: 'platform', displayName: 'Card' }, attributes: { title: 'Shared Card', value: 'Ready' }, children: [] }) },
];

const NodeOutline: React.FC<{ nodes: StudioNode[]; selectedId: string | null; onSelect: (id: string) => void; depth?: number }> = ({ nodes, selectedId, onSelect, depth = 0 }) => <>{nodes.map((node) => <React.Fragment key={node.id}><button type="button" className={`btn btn-sm border-0 rounded-1 w-100 text-start d-flex align-items-center py-1 ${selectedId === node.id ? 'bg-primary text-white' : 'text-secondary'}`} style={{ paddingLeft: `${depth * 12 + 4}px`, fontSize: '.7rem' }} onClick={() => onSelect(node.id)}><ChevronRight size={10}/><span className="text-truncate">{node.kind === 'text' ? `Text: ${node.text}` : `<${node.tag || node.kind}>`}</span></button>{node.children?.length ? <NodeOutline nodes={node.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1}/> : null}</React.Fragment>)}</>;

const VisualNode: React.FC<{ node: StudioNode; selectedId: string | null; onSelect: (id: string) => void }> = ({ node, selectedId, onSelect }) => {
  if (node.kind === 'text') return <span onClick={(event) => { event.stopPropagation(); onSelect(node.id); }} style={selectedId === node.id ? { outline: '2px solid #0c58a9' } : undefined}>{node.text}</span>;
  if (node.kind === 'component') {
    const Target = COMPONENT_REGISTRY[node.componentRef?.id as keyof typeof COMPONENT_REGISTRY];
    return <div id={typeof node.attributes?.id === 'string' ? node.attributes.id : undefined} data-component-instance-id={node.id} data-layout-region={typeof node.attributes?.__layoutRegion === 'string' ? node.attributes.__layoutRegion : typeof node.attributes?.__sectionId === 'string' ? node.attributes.__sectionId : undefined} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }} style={selectedId === node.id ? { outline: '2px solid #0c58a9', outlineOffset: '2px' } : undefined}>{Target ? <Target {...(node.attributes || {})}>{node.children?.map((child) => <VisualNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect}/>)}</Target> : <div className="alert alert-warning">Shared: {node.componentRef?.displayName || node.componentRef?.id}</div>}</div>;
  }
  const Tag = (node.tag || 'div') as keyof React.JSX.IntrinsicElements;
  const attributes = Object.fromEntries(Object.entries(node.attributes || {}).filter(([, value]) => typeof value !== 'object')) as Record<string, string | number | boolean>;
  return <Tag {...attributes} className={node.classList?.join(' ')} onClick={(event: React.MouseEvent) => { event.stopPropagation(); onSelect(node.id); }} style={selectedId === node.id ? { outline: '2px solid #0c58a9', outlineOffset: '2px' } : undefined}>{node.children?.map((child) => <VisualNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect}/>)}</Tag>;
};

export const HtmlStudioShell: React.FC<HtmlStudioShellProps> = ({ document: initialDocument, onSave, onClose, embedded = false, onDirtyChange, openInNewTabUrl }) => {
  const [document, setDocument] = useState(() => cloneDocument(initialDocument));
  const [selectedId, setSelectedId] = useState<string | null>(initialDocument.root[0]?.id || null);
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [source, setSource] = useState(() => serializeStudioNodes(initialDocument.root));
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [draggedLibraryLabel, setDraggedLibraryLabel] = useState<string | null>(null);
  const baselineRef = React.useRef(JSON.stringify(initialDocument));
  const selected = useMemo(() => selectedId ? findNode(document.root, selectedId) : null, [document.root, selectedId]);
  const artifact = useMemo(() => compileDocument(document), [document]);
  useEffect(() => { onDirtyChange?.(JSON.stringify(document) !== baselineRef.current); }, [document, onDirtyChange]);
  useEffect(() => { if (viewMode !== 'source') setSource(serializeStudioNodes(document.root)); }, [document.root, viewMode]);
  const updateSelected = (change: (node: StudioNode) => StudioNode) => selectedId && setDocument((current) => ({ ...current, root: updateNode(current.root, selectedId, change), updatedAt: new Date().toISOString() }));
  const applySource = () => { const result = parseHtmlSource(source); setSourceErrors(result.errors); if (!result.errors.length) { setDocument((current) => ({ ...current, root: result.nodes, updatedAt: new Date().toISOString() })); setSelectedId(result.nodes[0]?.id || null); } };
  const width = device === 'mobile' ? 375 : device === 'tablet' ? 768 : 1200;
  const addLibraryItem = (label: string) => {
    const item = LIBRARY.find((candidate) => candidate.label === label);
    if (!item) return;
    const node = item.node();
    setDocument((current) => ({ ...current, root: appendNode(current.root, selected?.kind === 'element' ? selected.id : null, node), updatedAt: new Date().toISOString() }));
    setSelectedId(node.id);
  };
  const addExternalDrop = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData('application/x-lowcode-studio-item') || event.dataTransfer.getData('text/plain');
    if (!raw) return false;
    try {
      const payload = JSON.parse(raw) as { kind?: string; componentType?: string; label?: string; defaultProps?: Record<string, unknown>; assetId?: string };
      let node: StudioNode | null = null;
      if (payload.kind === 'component' && payload.componentType) node = { id: createNodeId('shared'), kind: 'component', componentRef: { id: payload.componentType, scope: 'platform', displayName: payload.label || payload.componentType }, attributes: JSON.parse(JSON.stringify(payload.defaultProps || {})), children: [] };
      if (payload.kind === 'asset' && payload.assetId) node = { id: createNodeId('asset'), kind: 'element', tag: 'img', classList: ['img-fluid'], attributes: { src: `asset://${payload.assetId}`, alt: payload.label || payload.assetId, loading: 'lazy', 'data-asset-ref': payload.assetId } };
      if (!node) return false;
      setDocument((current) => ({ ...current, root: appendNode(current.root, selected?.kind === 'element' ? selected.id : null, node as StudioNode), updatedAt: new Date().toISOString() }));
      setSelectedId(node.id);
      return true;
    } catch { return false; }
  };
  useEffect(() => {
    const addFromExplorer = (event: Event) => {
      const payload = (event as CustomEvent<{ componentType?: string; label?: string; defaultProps?: Record<string, unknown> }>).detail;
      if (!payload?.componentType) return;
      const node: StudioNode = { id: createNodeId('shared'), kind: 'component', componentRef: { id: payload.componentType, scope: 'platform', displayName: payload.label || payload.componentType }, attributes: JSON.parse(JSON.stringify(payload.defaultProps || {})), children: [] };
      setDocument((current) => ({ ...current, root: appendNode(current.root, selected?.kind === 'element' ? selected.id : null, node), updatedAt: new Date().toISOString() }));
      setSelectedId(node.id);
    };
    window.addEventListener('lowcode:add-html-studio-component', addFromExplorer);
    return () => window.removeEventListener('lowcode:add-html-studio-component', addFromExplorer);
  }, [selected]);

  const saveDocument = () => {
    const next = { ...document, version: document.version + 1, updatedAt: new Date().toISOString() };
    setDocument(next);
    baselineRef.current = JSON.stringify(next);
    onDirtyChange?.(false);
    onSave(next);
  };

  return <div className={`${embedded ? 'w-100 h-100 position-relative' : 'position-fixed top-0 start-0 w-100 h-100'} bg-dark d-flex flex-column`} style={embedded ? { minHeight: 'calc(100vh - 340px)' } : { zIndex: 3000 }}>
    {openInNewTabUrl && <button type="button" className="btn btn-warning btn-sm position-absolute d-flex align-items-center gap-1" style={{ zIndex: 5, top: 7, right: 350 }} onClick={() => window.open(openInNewTabUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={13}/> แก้ไข Page</button>}
    <div className="d-flex align-items-center justify-content-between px-3 py-2 text-white border-bottom border-secondary"><div><strong>แก้ไขหน้าเว็บ</strong><span className="text-white-50 ms-2 small">{document.name}</span></div><div className="d-flex gap-2"><div className="btn-group btn-group-sm"><button className={`btn ${viewMode === 'visual' ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setViewMode('visual')}><Eye size={13}/> ภาพ</button><button className={`btn ${viewMode === 'split' ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setViewMode('split')}><LayoutPanelLeft size={13}/> สองฝั่ง</button><button className={`btn ${viewMode === 'source' ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setViewMode('source')}><Code2 size={13}/> โค้ด</button></div><div className="btn-group btn-group-sm"><button className={`btn ${device === 'desktop' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setDevice('desktop')}><Monitor size={13}/></button><button className={`btn ${device === 'tablet' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setDevice('tablet')}><Tablet size={13}/></button><button className={`btn ${device === 'mobile' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setDevice('mobile')}><Smartphone size={13}/></button></div><button className="btn btn-success btn-sm" onClick={saveDocument}><Save size={13}/> บันทึกหน้า</button>{!embedded && onClose && <button className="btn btn-outline-light btn-sm" onClick={onClose}><X size={15}/></button>}</div></div>
    <div className="d-flex flex-grow-1 overflow-hidden">
      <main className="flex-grow-1 bg-secondary bg-opacity-25 overflow-auto d-flex gap-2 p-2" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={(event) => { event.preventDefault(); if (!addExternalDrop(event) && draggedLibraryLabel) addLibraryItem(draggedLibraryLabel); setDraggedLibraryLabel(null); }}>{viewMode !== 'source' && <div className="bg-white shadow-sm mx-auto overflow-auto position-relative" style={{ width, maxWidth: viewMode === 'split' ? '50%' : '100%', transition: 'width .2s', minHeight: '100%' }}><div className="position-absolute top-0 start-50 translate-middle-x badge bg-dark bg-opacity-50 mt-2">ลากส่วนประกอบหรือไฟล์มาวางที่นี่</div><div className="p-3 pt-5" data-hs-scope={document.styleSheet.scopeId}>{artifact.cssText && <style>{artifact.cssText}</style>}{document.root.map((node) => <VisualNode key={node.id} node={node} selectedId={selectedId} onSelect={setSelectedId}/>)}</div></div>}{viewMode !== 'visual' && <div className="d-flex flex-column bg-white" style={{ width: viewMode === 'split' ? '50%' : '100%' }}><div className="d-flex justify-content-between align-items-center p-2 border-bottom"><span className="small fw-bold"><Braces size={13}/> โค้ด HTML</span><button className="btn btn-primary btn-sm" onClick={applySource}>ใช้โค้ดนี้</button></div><textarea className="form-control border-0 rounded-0 font-monospace flex-grow-1" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false}/>{sourceErrors.length ? <div className="alert alert-danger rounded-0 mb-0 py-2 small">{sourceErrors.join(' ')}</div> : null}</div>}</main>
      <aside className="bg-white border-start p-3 overflow-auto" style={{ width: 280 }}><div className="d-flex justify-content-between align-items-center mb-3"><strong className="small">รายละเอียด</strong>{selected && <button className="btn btn-sm btn-outline-danger" onClick={() => { setDocument((current) => ({ ...current, root: removeNode(current.root, selected.id) })); setSelectedId(null); }}><Trash2 size={12}/></button>}</div>{selected ? <div className="d-flex flex-column gap-3"><div><label className="form-label small">รหัส</label><input className="form-control form-control-sm" value={selected.id} disabled/></div>{selected.kind === 'text' ? <div><label className="form-label small">ข้อความ</label><textarea className="form-control form-control-sm" value={selected.text || ''} onChange={(event) => updateSelected((node) => ({ ...node, text: event.target.value }))}/></div> : <><div><label className="form-label small">ชนิดแท็ก</label><input className="form-control form-control-sm" value={selected.tag || ''} disabled/></div><div><label className="form-label small">คลาส CSS</label><input className="form-control form-control-sm" value={selected.classList?.join(' ') || ''} onChange={(event) => updateSelected((node) => ({ ...node, classList: event.target.value.split(/\s+/).filter(Boolean) }))}/></div>{selected.tag === 'img' && <><div><label className="form-label small">ที่อยู่รูปภาพ</label><input className="form-control form-control-sm" value={String(selected.attributes?.src || '')} onChange={(event) => updateSelected((node) => ({ ...node, attributes: { ...node.attributes, src: event.target.value } }))}/></div><div><label className="form-label small">คำบรรยายรูป</label><input className="form-control form-control-sm" value={String(selected.attributes?.alt || '')} onChange={(event) => updateSelected((node) => ({ ...node, attributes: { ...node.attributes, alt: event.target.value } }))}/></div></>}</>}</div> : <div className="text-muted small">เลือกส่วนประกอบบนหน้าเว็บเพื่อดูรายละเอียด</div>}<hr/><div className="small fw-bold mb-2">ผลตรวจสอบ</div>{artifact.diagnostics.length ? artifact.diagnostics.map((item, index) => <div key={index} className={`alert py-1 px-2 small ${item.severity === 'error' ? 'alert-danger' : 'alert-warning'}`}>{item.message}</div>) : <div className="text-success small">ไม่พบข้อผิดพลาด</div>}</aside>
    </div>
  </div>;
};
