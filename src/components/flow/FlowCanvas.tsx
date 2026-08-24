'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode, ActionNode, ConditionNode } from './CustomNodes';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

interface FlowCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onFlowChange?: (nodes: Node[], edges: Edge[]) => void;
  onNodeSelect?: (node: Node) => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  initialNodes = [
    { id: 't1', type: 'trigger', position: { x: 50, y: 150 }, data: { label: 'On Form Submit' } },
    { id: 'a1', type: 'action', position: { x: 300, y: 150 }, data: { label: 'Show Toast Alert', actionType: 'showAlert' } },
  ],
  initialEdges = [{ id: 'e1-2', source: 't1', target: 'a1' }],
  onFlowChange,
  onNodeSelect,
}) => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (onFlowChange) onFlowChange(updated, edges);
        return updated;
      });
    },
    [edges, onFlowChange]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        if (onFlowChange) onFlowChange(nodes, updated);
        return updated;
      });
    },
    [nodes, onFlowChange]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const updated = addEdge(params, eds);
        if (onFlowChange) onFlowChange(nodes, updated);
        return updated;
      });
    },
    [nodes, onFlowChange]
  );

  const addNode = (type: 'trigger' | 'action' | 'condition', label: string, actionType?: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type,
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: { label, actionType, config: { message: 'Workflow action triggered successfully!' } },
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      if (onFlowChange) onFlowChange(updated, edges);
      return updated;
    });
  };

  return (
    <div className="w-100 h-100 position-relative bg-light rounded overflow-hidden" style={{ minHeight: '500px' }}>
      {/* Node Addition Toolbar */}
      <div className="position-absolute top-0 start-0 z-3 p-3 d-flex gap-2">
        <button className="btn btn-sm btn-primary shadow-sm" onClick={() => addNode('trigger', 'On Button Click')}>
          + Add Trigger
        </button>
        <button
          className="btn btn-sm btn-success shadow-sm"
          onClick={() => addNode('action', 'Show Alert Dialog', 'showAlert')}
        >
          + Add Action
        </button>
        <button
          className="btn btn-sm btn-warning text-dark shadow-sm"
          onClick={() => addNode('condition', 'Check User Role')}
        >
          + Add Condition
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeSelect?.(node)}
        fitView
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  );
};
