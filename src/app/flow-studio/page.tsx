'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LifelineHeaderNode, SequenceStepNode } from '@/components/flow/SequenceCustomNodes';
import { LifelineParticipant, SequenceMessageType } from '@/types';
import {
  Workflow,
  Play,
  Save,
  Code2,
  User,
  Globe,
  Zap,
  Server,
  Database,
  FileCode,
  Sliders,
  X,
} from 'lucide-react';

export default function FlowStudioPage() {
  // Register custom node components
  const nodeTypes = useMemo(
    () => ({
      lifelineHeaderNode: LifelineHeaderNode,
      sequenceStepNode: SequenceStepNode,
    }),
    []
  );

  // 6 Lifeline Column X Positions
  const lifelineXPositions: Record<LifelineParticipant, number> = {
    user: 80,
    browser: 320,
    api: 560,
    server: 800,
    db: 1040,
    file: 1280,
  };

  // Top Swimlane Lifeline Column Header Nodes
  const headerNodes: Node[] = [
    { id: 'hdr_user', type: 'lifelineHeaderNode', position: { x: 80, y: 30 }, data: { participant: 'user' }, draggable: false },
    { id: 'hdr_browser', type: 'lifelineHeaderNode', position: { x: 320, y: 30 }, data: { participant: 'browser' }, draggable: false },
    { id: 'hdr_api', type: 'lifelineHeaderNode', position: { x: 560, y: 30 }, data: { participant: 'api' }, draggable: false },
    { id: 'hdr_server', type: 'lifelineHeaderNode', position: { x: 800, y: 30 }, data: { participant: 'server' }, draggable: false },
    { id: 'hdr_db', type: 'lifelineHeaderNode', position: { x: 1040, y: 30 }, data: { participant: 'db' }, draggable: false },
    { id: 'hdr_file', type: 'lifelineHeaderNode', position: { x: 1280, y: 30 }, data: { participant: 'file' }, draggable: false },
  ];

  // Default Sequence Flow Nodes (Default Flow)
  const initialStepNodes: Node[] = [
    {
      id: 'seq_step_1',
      type: 'sequenceStepNode',
      position: { x: 80, y: 120 },
      data: {
        stepNumber: 1,
        label: '🚀 Start Entry: Request App URL',
        sourceLifeline: 'user',
        targetLifeline: 'browser',
        messageType: 'request',
      },
    },
    {
      id: 'seq_step_2',
      type: 'sequenceStepNode',
      position: { x: 320, y: 210 },
      data: {
        stepNumber: 2,
        label: '🛡️ Auth Check?: Validate Session Cookie',
        sourceLifeline: 'browser',
        targetLifeline: 'api',
        messageType: 'request',
      },
    },
    {
      id: 'seq_step_3',
      type: 'sequenceStepNode',
      position: { x: 560, y: 300 },
      data: {
        stepNumber: 3,
        label: 'Query Core DB & Profile Data',
        sourceLifeline: 'api',
        targetLifeline: 'db',
        messageType: 'request',
      },
    },
    {
      id: 'seq_step_4',
      type: 'sequenceStepNode',
      position: { x: 320, y: 390 },
      data: {
        stepNumber: 4,
        label: '🔐 Private / Public Router: Load Page AST',
        sourceLifeline: 'api',
        targetLifeline: 'browser',
        messageType: 'response',
      },
    },
    {
      id: 'seq_step_5',
      type: 'sequenceStepNode',
      position: { x: 320, y: 480 },
      data: {
        stepNumber: 5,
        label: '🎧 Event Listener Loop: Active (Menu+Route+Timer)',
        sourceLifeline: 'browser',
        targetLifeline: 'browser',
        messageType: 'async',
      },
    },
    {
      id: 'seq_step_6',
      type: 'sequenceStepNode',
      position: { x: 80, y: 570 },
      data: {
        stepNumber: 6,
        label: '🛑 Close Terminate: Logout Session',
        sourceLifeline: 'user',
        targetLifeline: 'server',
        messageType: 'request',
      },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1', source: 'seq_step_1', target: 'seq_step_2', animated: true, label: 'URL Load' },
    { id: 'e2', source: 'seq_step_2', target: 'seq_step_3', animated: true, label: 'Verify JWT' },
    { id: 'e3', source: 'seq_step_3', target: 'seq_step_4', animated: true, label: 'Return Profile' },
    { id: 'e4', source: 'seq_step_4', target: 'seq_step_5', animated: true, label: 'Render UI' },
    { id: 'e5', source: 'seq_step_5', target: 'seq_step_6', label: 'User Logout' },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState([...headerNodes, ...initialStepNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [testRunStatus, setTestRunStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The sequence diagram belongs to a Platform Master, so pick one to persist against.
  const [platforms, setPlatforms] = useState<Array<{ id: string; platformName: string }>>([]);
  const [platformId, setPlatformId] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platforms', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload.platforms) return;
        setPlatforms(payload.platforms);
        setPlatformId((current) => current || payload.platforms[0]?.id || '');
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Load the saved diagram whenever the selected platform changes.
  useEffect(() => {
    if (!platformId) return;
    let cancelled = false;
    fetch(`/api/platforms/${platformId}/workflows?flowCode=MASTER_SEQUENCE`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload.workflow) return;
        if (Array.isArray(payload.workflow.nodes) && payload.workflow.nodes.length) {
          setNodes(payload.workflow.nodes as Node[]);
          setEdges((payload.workflow.edges ?? []) as Edge[]);
          setSaveStatus('โหลด Sequence Flow จากฐานข้อมูลแล้ว');
          setTimeout(() => setSaveStatus(null), 2500);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  // Add Sequence Step Node to specific Lifeline Column
  const handleAddSequenceStep = (participant: LifelineParticipant) => {
    const stepCount = nodes.filter((n) => n.type === 'sequenceStepNode').length + 1;
    const xPos = lifelineXPositions[participant];
    const yPos = 120 + stepCount * 80;

    const newStepNode: Node = {
      id: `seq_step_${Date.now()}`,
      type: 'sequenceStepNode',
      position: { x: xPos, y: yPos },
      data: {
        stepNumber: stepCount,
        label: `New Step on ${participant.toUpperCase()}`,
        sourceLifeline: participant,
        targetLifeline: participant === 'user' ? 'browser' : participant === 'browser' ? 'api' : 'db',
        messageType: 'request',
      },
    };

    setNodes((prev) => [...prev, newStepNode]);
    setSelectedNode(newStepNode);
  };

  // Node Selection Handler
  const onNodeClick = (_: any, node: Node) => {
    if (node.type === 'lifelineHeaderNode') return;
    setSelectedNode(node);
  };

  // Update Node Data
  const handleUpdateNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updatedData = { ...n.data, [key]: value };
          if (key === 'sourceLifeline' && lifelineXPositions[value as LifelineParticipant]) {
            n.position.x = lifelineXPositions[value as LifelineParticipant];
          }
          setSelectedNode({ ...n, data: updatedData });
          return { ...n, data: updatedData };
        }
        return n;
      })
    );
  };

  // Delete Node
  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  // Test Run Sequence Evaluator
  const handleTestRunSequence = () => {
    setTestRunStatus('Simulating Sequence Lifelines Execution...');
    setTimeout(() => setTestRunStatus('1. 👤 User -> 🌐 Browser: Start Entry URL Request -> OK'), 600);
    setTimeout(() => setTestRunStatus('2. 🌐 Browser -> 🔌 API: Auth Check Session -> OK'), 1200);
    setTimeout(() => setTestRunStatus('3. 🔌 API -> 💾 DB: Fetch Core DB User Profile -> OK'), 1800);
    setTimeout(() => setTestRunStatus('4. 🔌 API -> 🌐 Browser: Private Router AST Injected -> OK'), 2400);
    setTimeout(() => setTestRunStatus('5. 🌐 Browser: Event Loop Active (Menu + Route + Timer) -> READY'), 3000);
    setTimeout(() => setTestRunStatus(null), 6000);
  };

  // Persist the diagram into public.platform_workflows.
  const handleSaveSequenceAst = async () => {
    if (!platformId) {
      setSaveStatus('กรุณาเลือก Platform ก่อนบันทึก');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/platforms/${platformId}/workflows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowCode: 'MASTER_SEQUENCE',
          flowName: 'Master Sequence Lifecycle Flow',
          flowType: 'SEQUENCE',
          nodes,
          edges,
          config: { lifelines: Object.keys(lifelineXPositions) },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึกไม่สำเร็จ');
      setSaveStatus('บันทึก Sequence Flow AST ลงฐานข้อมูลแล้ว');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  return (
    <div className="container-fluid p-0 d-flex flex-column min-vh-100 select-none">
      {/* Header Bar */}
      <div className="adm-banner mb-3">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3 min-w-0">
            <span className="rounded-3 bg-white bg-opacity-15 p-2 d-flex align-items-center justify-content-center text-white flex-shrink-0">
              <Workflow size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="adm-banner-eyebrow mb-0">ออกแบบขั้นตอนการทำงาน</p>
              <h1 className="adm-banner-title">ลำดับขั้นตอนของระบบ</h1>
              <p className="adm-banner-lead">
                วางลำดับว่าใครทำอะไรก่อนหลัง แล้วบันทึกไว้กับแม่แบบระบบ
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {saveStatus && <span className="stu-status is-ok" role="status">{saveStatus}</span>}

            <label htmlFor="flow-platform" className="visually-hidden">แม่แบบระบบที่จะบันทึกลำดับขั้นตอน</label>
            <select
              id="flow-platform"
              className="adm-select"
              style={{ width: 'auto', minHeight: '2.5rem' }}
              value={platformId}
              onChange={(event) => setPlatformId(event.target.value)}
            >
              <option value="">เลือกแม่แบบ…</option>
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.platformName}</option>
              ))}
            </select>

            <button type="button" className="adm-banner-btn is-ghost" onClick={() => setShowJsonModal(true)}>
              <Code2 size={15} aria-hidden="true" /> ดูโครงสร้าง
            </button>
            <button type="button" className="adm-banner-btn is-ghost" onClick={handleTestRunSequence}>
              <Play size={15} aria-hidden="true" /> ทดลองเดินลำดับ
            </button>
            <button
              type="button"
              className="adm-banner-btn"
              onClick={() => void handleSaveSequenceAst()}
              disabled={isSaving || !platformId}
            >
              <Save size={15} aria-hidden="true" /> {isSaving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>

        {testRunStatus && (
          <div className="mt-3 p-2 rounded-2 font-monospace" style={{ background: 'rgba(0,0,0,0.25)', fontSize: '0.78rem' }} role="status">
            {testRunStatus}
          </div>
        )}
      </div>

      {/* Adds one step to the diagram, aimed at the chosen participant. */}
      <div className="adm-card p-2 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-1 flex-wrap">
          <span className="adm-label mb-0 me-2">เพิ่มขั้นตอนไปยัง</span>
          {([
            ['user', 'ผู้ใช้', User],
            ['browser', 'เบราว์เซอร์', Globe],
            ['api', 'API', Zap],
            ['server', 'เซิร์ฟเวอร์', Server],
            ['db', 'ฐานข้อมูล', Database],
            ['file', 'ไฟล์', FileCode],
          ] as const).map(([target, label, Icon]) => (
            <button
              key={target}
              type="button"
              className="adm-btn is-quiet is-sm"
              onClick={() => handleAddSequenceStep(target)}
            >
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <p className="adm-help mb-0">
          คลิกที่ขั้นตอนใดก็ได้เพื่อแก้ชื่อ ต้นทาง ปลายทาง และชนิดของข้อความ
        </p>
      </div>

      {/* React Flow Canvas Workspace */}
      <div className="flex-grow-1 position-relative bg-white rounded-3 shadow-sm border overflow-hidden" style={{ width: '100%', height: '680px', minHeight: '680px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background variant={BackgroundVariant.Lines} gap={40} size={1} />
        </ReactFlow>

        {/* Selected Node Property Drawer (Offcanvas Inspector) */}
        {selectedNode && selectedNode.type === 'sequenceStepNode' && (
          <div
            className="position-absolute top-0 end-0 h-100 bg-white border-start shadow-lg p-3 z-3 animate-slideLeft overflow-auto select-none"
            style={{ width: '320px' }}
          >
            <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
              <div className="d-flex align-items-center gap-1.5">
                <Sliders size={16} className="text-primary" />
                <h6 className="fw-bold mb-0 text-dark small">Sequence Step Configurator</h6>
              </div>
              <button className="btn btn-sm btn-outline-secondary border-0 p-1 rounded-circle" onClick={() => setSelectedNode(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="d-flex flex-column gap-3 extra-small">
              <div>
                <label className="form-label extra-small fw-semibold text-secondary mb-1">Step Number</label>
                <input
                  type="number"
                  className="form-control form-control-sm bg-light"
                  value={Number(selectedNode.data.stepNumber || 1)}
                  onChange={(e) => handleUpdateNodeData('stepNumber', Number(e.target.value))}
                />
              </div>

              <div>
                <label className="form-label extra-small fw-semibold text-secondary mb-1">Step Title / Description</label>
                <textarea
                  className="form-control form-control-sm bg-light"
                  rows={2}
                  value={String(selectedNode.data.label || '')}
                  onChange={(e) => handleUpdateNodeData('label', e.target.value)}
                />
              </div>

              <div>
                <label className="form-label extra-small fw-semibold text-secondary mb-1">Source Lifeline Participant</label>
                <select
                  className="form-select form-select-sm bg-light"
                  value={String(selectedNode.data.sourceLifeline || 'user')}
                  onChange={(e) => handleUpdateNodeData('sourceLifeline', e.target.value as LifelineParticipant)}
                >
                  <option value="user">👤 1. User</option>
                  <option value="browser">🌐 2. Browser</option>
                  <option value="api">🔌 3. API</option>
                  <option value="server">🖥️ 4. Server</option>
                  <option value="db">💾 5. DB</option>
                  <option value="file">📁 6. File</option>
                </select>
              </div>

              <div>
                <label className="form-label extra-small fw-semibold text-secondary mb-1">Target Lifeline Participant</label>
                <select
                  className="form-select form-select-sm bg-light"
                  value={String(selectedNode.data.targetLifeline || 'browser')}
                  onChange={(e) => handleUpdateNodeData('targetLifeline', e.target.value as LifelineParticipant)}
                >
                  <option value="user">👤 1. User</option>
                  <option value="browser">🌐 2. Browser</option>
                  <option value="api">🔌 3. API</option>
                  <option value="server">🖥️ 4. Server</option>
                  <option value="db">💾 5. DB</option>
                  <option value="file">📁 6. File</option>
                </select>
              </div>

              <div>
                <label className="form-label extra-small fw-semibold text-secondary mb-1">Message Arrow Type</label>
                <select
                  className="form-select form-select-sm bg-light"
                  value={String(selectedNode.data.messageType || 'request')}
                  onChange={(e) => handleUpdateNodeData('messageType', e.target.value as SequenceMessageType)}
                >
                  <option value="request">➡️ Request Arrow (Blue)</option>
                  <option value="response">⬅️ Response Arrow (Green)</option>
                  <option value="async">↺ Async Event (Orange)</option>
                  <option value="decision">❓ Decision Branch (Red)</option>
                </select>
              </div>

              <div className="pt-2 border-top">
                <button className="btn btn-sm btn-outline-danger w-100 extra-small" onClick={() => handleDeleteNode(selectedNode.id)}>
                  Delete Sequence Step
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JSON AST Modal */}
      {showJsonModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center z-3" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
          <div className="card shadow-lg border-0 rounded-3 bg-white overflow-hidden w-100" style={{ maxWidth: '650px' }}>
            <div className="card-header bg-dark text-white p-3 d-flex align-items-center justify-content-between">
              <h6 className="fw-bold mb-0 text-white small d-flex align-items-center gap-2">
                <Code2 size={16} /> Sequence Workflow AST JSON
              </h6>
              <button className="btn btn-sm btn-outline-light border-0 p-1" onClick={() => setShowJsonModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="card-body p-3">
              <textarea
                className="form-control font-monospace extra-small bg-dark text-light p-3 rounded-3"
                rows={15}
                value={JSON.stringify({ nodes, edges }, null, 2)}
                readOnly
                style={{ fontSize: '0.78rem' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
