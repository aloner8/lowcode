'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edge, Node } from '@xyflow/react';
import { Database, FileText, Save, Workflow } from 'lucide-react';
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { getServiceDefinition } from '@/lib/services/catalog';
import { serviceKeyOf } from '@/lib/services/bindings';
import type { StudioServiceDefinition } from '@/types';

interface StudioPage { id: string; name: string; title: string }
interface PageFlowDesignerProps { platformId: string; routePath: string; routeLabel: string; suggestedType: 'public_page' | 'form_crud'; pages: StudioPage[]; services?: StudioServiceDefinition[] }
interface StoredFlow { templateType: 'public_page' | 'form_crud'; nodes: Node[]; edges: Edge[] }

const templates = {
  public_page: {
    title: 'Public Page Flow',
    description: 'อ่าน config → set app components → set style',
    nodes: [
      { id: 'read_config', type: 'trigger', position: { x: 40, y: 170 }, data: { label: 'Read Page Config' } },
      { id: 'set_components', type: 'action', position: { x: 310, y: 100 }, data: { label: 'Set App Components', actionType: 'setComponents' } },
      { id: 'set_style', type: 'action', position: { x: 580, y: 170 }, data: { label: 'Set Page Style', actionType: 'setStyle' } },
    ] as Node[],
    edges: [{ id: 'pub-1', source: 'read_config', target: 'set_components' }, { id: 'pub-2', source: 'set_components', target: 'set_style' }] as Edge[],
  },
  form_crud: {
    title: 'Form CRUD Flow',
    description: 'Schema check → prepare procedure → Insert/Update/Filter → special calculation',
    nodes: [
      { id: 'form_event', type: 'trigger', position: { x: 30, y: 180 }, data: { label: 'Form Event' } },
      { id: 'schema_check', type: 'condition', position: { x: 270, y: 180 }, data: { label: 'Schema Check' } },
      { id: 'prepare_proc', type: 'action', position: { x: 520, y: 80 }, data: { label: 'Prepare DB Procedure', actionType: 'prepareProcedure' } },
      { id: 'crud', type: 'action', position: { x: 760, y: 80 }, data: { label: 'Insert / Update / Filter', actionType: 'databaseMutation' } },
      { id: 'special_fn', type: 'action', position: { x: 520, y: 300 }, data: { label: 'Special Calculation Function', actionType: 'calculate' } },
    ] as Node[],
    edges: [
      { id: 'form-1', source: 'form_event', target: 'schema_check' }, { id: 'form-2', source: 'schema_check', target: 'prepare_proc' },
      { id: 'form-3', source: 'prepare_proc', target: 'crud' }, { id: 'form-4', source: 'schema_check', target: 'special_fn' },
    ] as Edge[],
  },
};

export const PageFlowDesigner: React.FC<PageFlowDesignerProps> = ({ platformId, routePath, routeLabel, suggestedType, pages, services = [] }) => {
  const [flow, setFlow] = useState<StoredFlow | null>(null);
  const [draft, setDraft] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [status, setStatus] = useState('Loading flow from database...');
  const [templateType, setTemplateType] = useState<'public_page' | 'form_crud'>(suggestedType);
  const [templatePageId, setTemplatePageId] = useState(pages[0]?.id || '');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    const load = async () => {
      setStatus('Loading flow from database...');
      const response = await fetch(`/api/platforms/${platformId}/page-flows?route=${encodeURIComponent(routePath)}`, { cache: 'no-store' });
      const data = (await response.json()) as { flow?: StoredFlow | null; error?: string };
      if (!response.ok) { setStatus(data.error || 'Load failed'); return; }
      if (!data.flow) { setFlow(null); setDraft(null); setShowTemplates(true); setStatus(''); return; }
      setFlow(data.flow); setDraft({ nodes: data.flow.nodes, edges: data.flow.edges }); setShowTemplates(false); setStatus('Loaded from database');
    };
    void load();
  }, [platformId, routePath]);

  const selectTemplate = (type: 'public_page' | 'form_crud') => {
    if (!templatePageId) { setStatus('กรุณาเลือก Page Layout'); return; }
    const template = templates[type];
    const selectedPage = pages.find((page) => page.id === templatePageId);
    const configuredNodes = template.nodes.map((node) => node.id === 'read_config' || node.id === 'form_event'
      ? { ...node, data: { ...node.data, pageId: templatePageId, pageTitle: selectedPage?.title || templatePageId } }
      : node);
    setFlow({ templateType: type, nodes: configuredNodes, edges: template.edges });
    setDraft({ nodes: configuredNodes, edges: template.edges });
    setShowTemplates(false);
    setStatus('Template selected — click Save Flow to create database data');
  };
  const onFlowChange = useCallback((nodes: Node[], edges: Edge[]) => setDraft({ nodes, edges }), []);
  const updateNodePage = (pageId: string) => {
    if (!selectedNode || !draft) return;
    const page = pages.find((item) => item.id === pageId);
    const nodes = draft.nodes.map((node) => node.id === selectedNode.id
      ? { ...node, data: { ...node.data, pageId, pageTitle: page?.title || pageId } }
      : node);
    setDraft({ ...draft, nodes });
    setFlow((current) => current ? { ...current, nodes } : current);
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, pageId, pageTitle: page?.title || pageId } });
    setStatus('Node configuration changed — click Save Flow');
  };
  const updateSelectedNodeData = (changes: Record<string, unknown>) => {
    if (!selectedNode || !draft) return;
    const data = { ...selectedNode.data, ...changes };
    const nodes = draft.nodes.map((node) => node.id === selectedNode.id ? { ...node, data } : node);
    setDraft({ ...draft, nodes }); setFlow((current) => current ? { ...current, nodes } : current); setSelectedNode({ ...selectedNode, data });
    setStatus('Node configuration changed — click Save Flow');
  };
  const save = async () => {
    if (!flow || !draft) return;
    setStatus('Saving...');
    const response = await fetch(`/api/platforms/${platformId}/page-flows`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routePath, routeLabel, templateType: flow.templateType, ...draft }) });
    const data = (await response.json()) as { error?: string };
    setStatus(response.ok ? 'Saved to database' : data.error || 'Save failed');
  };

  return <div className="card border-0 shadow-sm h-100">
    <div className="card-header bg-white d-flex justify-content-between align-items-center py-2 px-3">
      <div className="d-flex align-items-center gap-2"><Workflow size={18} className="text-primary" /><div><strong>{routeLabel} Flow</strong><div className="small text-secondary"><code>{routePath}</code> · {status}</div></div></div>
      <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => void save()} disabled={!flow}><Save size={14} /> Save Flow</button>
    </div>
    <div className="card-body p-0" style={{ height: 'calc(100vh - 300px)', minHeight: 520 }}>
      {flow && draft && <FlowCanvas key={`${routePath}-${flow.templateType}`} initialNodes={draft.nodes} initialEdges={draft.edges} onFlowChange={onFlowChange} onNodeSelect={setSelectedNode} />}
    </div>
    {showTemplates && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2100, background: 'rgba(15,23,42,.65)', backdropFilter: 'blur(4px)' }}>
      <div className="card border-0 shadow-lg rounded-4" style={{ width: 'min(94vw, 720px)' }}><div className="card-body p-4">
        <h4 className="fw-bold mb-1">Choose Page Flow Template</h4><p className="text-secondary">ยังไม่มี Flow ของ <strong>{routeLabel}</strong> ในฐานข้อมูล เลือก Template เริ่มต้นก่อนสร้างข้อมูลจริง</p>
        <div className="mb-3"><label className="form-label fw-semibold">Page Layout ที่ Flow นี้ผูกอยู่</label><select className="form-select" value={templatePageId} onChange={(event) => setTemplatePageId(event.target.value)}>
          {pages.map(page => <option key={page.id} value={page.id}>{page.title} ({page.id}.page)</option>)}
        </select><div className="form-text">ค่า Page นี้จะถูกบันทึกใน node ที่ทำหน้าที่อ่าน Page Config</div></div>
        <div className="row g-3">{(['public_page','form_crud'] as const).map(type => <div className="col-md-6" key={type}><button className={`card w-100 h-100 text-start p-3 bg-white ${templateType === type ? 'border-primary border-2' : ''}`} onClick={() => setTemplateType(type)}>
          <div className="d-flex gap-2 align-items-center mb-2">{type === 'public_page' ? <FileText className="text-primary" /> : <Database className="text-success" />}<strong>{templates[type].title}</strong></div><span className="small text-secondary">{templates[type].description}</span>{suggestedType === type && <span className="badge bg-primary mt-3 align-self-start">Recommended</span>}</button></div>)}</div>
        <div className="d-flex justify-content-end mt-3"><button className="btn btn-primary" onClick={() => selectTemplate(templateType)} disabled={!templatePageId}>Use Selected Template</button></div>
        <div className="small text-muted mt-3">สามารถเพิ่ม Template ประเภทใหม่ได้ในอนาคตโดยไม่กระทบ Flow ที่บันทึกแล้ว</div>
      </div></div>
    </div>}
    {selectedNode && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2200, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(3px)' }} onMouseDown={() => setSelectedNode(null)}>
      <div className="card border-0 shadow-lg rounded-4" style={{ width: 'min(92vw, 520px)' }} onMouseDown={event => event.stopPropagation()}><div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start mb-3"><div><div className="text-primary small fw-bold">FLOW NODE CONFIGURATION</div><h5 className="fw-bold mb-0">{String(selectedNode.data.label || 'Node')}</h5></div><button className="btn-close" onClick={() => setSelectedNode(null)} /></div>
        <label className="form-label fw-semibold">Node Label</label><input className="form-control mb-3" value={String(selectedNode.data.label || '')} onChange={(event) => updateSelectedNodeData({ label: event.target.value })}/>
        {selectedNode.type === 'action' && <><label className="form-label fw-semibold">Action Type</label><select className="form-select mb-3" value={String(selectedNode.data.actionType || '')} onChange={(event) => updateSelectedNodeData({ actionType: event.target.value })}><option value="">Select action...</option><option value="serviceCall">Shared Service Call</option><option value="navigate">Navigate Page</option><option value="apiCall">API Call</option><option value="databaseMutation">Database Mutation</option><option value="showAlert">Show Alert</option></select></>}
        {selectedNode.data.actionType === 'serviceCall' && <div className="row g-2 mb-3"><div className="col-md-7"><label className="form-label fw-semibold">Service Binding</label><select className="form-select" value={String((selectedNode.data.config as any)?.bindingId || '')} onChange={(event) => updateSelectedNodeData({ config: { ...((selectedNode.data.config as object) || {}), bindingId: event.target.value, operation: '' } })}><option value="">Not assigned</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} ({service.id})</option>)}</select></div><div className="col-md-5"><label className="form-label fw-semibold">Operation</label><select className="form-select" value={String((selectedNode.data.config as any)?.operation || '')} onChange={(event) => updateSelectedNodeData({ config: { ...((selectedNode.data.config as object) || {}), operation: event.target.value } })}><option value="">Not assigned</option>{Object.keys(getServiceDefinition(serviceKeyOf(services.find((item) => item.id === (selectedNode.data.config as any)?.bindingId) || ({ id: '', name: '', kind: 'auth', enabled: false, config: {}, containerBindings: [] } as StudioServiceDefinition)))?.operations || {}).map((operation) => <option key={operation} value={operation}>{operation}</option>)}</select></div><div className="col-12"><label className="form-label fw-semibold">Input JSON</label><textarea className="form-control font-monospace" rows={4} value={JSON.stringify((selectedNode.data.config as any)?.input || {}, null, 2)} onChange={(event) => { try { updateSelectedNodeData({ config: { ...((selectedNode.data.config as object) || {}), input: JSON.parse(event.target.value) } }); } catch { /* retain last valid JSON */ } }}/></div></div>}
        {selectedNode.data.actionType === 'navigate' && <><label className="form-label fw-semibold">Target Page</label><select className="form-select mb-3" value={String(selectedNode.data.targetPageId || '')} onChange={(event) => updateSelectedNodeData({ targetPageId: event.target.value })}><option value="">Not assigned</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.title} ({page.id}.page)</option>)}</select></>}
        {(selectedNode.id === 'read_config' || selectedNode.id === 'form_event') ? <><label className="form-label fw-semibold">Related Page Layout</label><select className="form-select" value={String(selectedNode.data.pageId || '')} onChange={event => updateNodePage(event.target.value)}>
          {pages.map(page => <option key={page.id} value={page.id}>{page.title} ({page.id}.page)</option>)}
        </select><div className="alert alert-info py-2 small mt-3 mb-0">Node นี้จะอ่าน config และ component tree จาก Page Layout ที่เลือก</div></> : <div className="text-secondary small">Node นี้ไม่มี Page Layout binding โดยตรง</div>}
        <div className="d-flex justify-content-end mt-4"><button className="btn btn-primary" onClick={() => setSelectedNode(null)}>Done</button></div>
      </div></div>
    </div>}
  </div>;
};
