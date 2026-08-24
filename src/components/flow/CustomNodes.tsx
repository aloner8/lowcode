'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play, Zap, HelpCircle, ArrowRight } from 'lucide-react';

export const TriggerNode = memo(({ data }: NodeProps) => {
  return (
    <div className="card shadow border-2 border-primary bg-white px-3 py-2 rounded-3" style={{ minWidth: '180px' }}>
      <div className="d-flex align-items-center gap-2">
        <div className="bg-primary text-white p-1 rounded">
          <Zap size={16} />
        </div>
        <div>
          <small className="text-primary fw-bold uppercase d-block" style={{ fontSize: '10px' }}>
            TRIGGER
          </small>
          <strong className="small text-dark">{String(data.label || 'On Event')}</strong>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="bg-primary p-1 border-white" />
    </div>
  );
});

export const ActionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="card shadow border-2 border-success bg-white px-3 py-2 rounded-3" style={{ minWidth: '180px' }}>
      <Handle type="target" position={Position.Left} className="bg-success p-1 border-white" />
      <div className="d-flex align-items-center gap-2">
        <div className="bg-success text-white p-1 rounded">
          <Play size={16} />
        </div>
        <div>
          <small className="text-success fw-bold uppercase d-block" style={{ fontSize: '10px' }}>
            ACTION
          </small>
          <strong className="small text-dark">{String(data.label || 'Run Action')}</strong>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="bg-success p-1 border-white" />
    </div>
  );
});

export const ConditionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="card shadow border-2 border-warning bg-white px-3 py-2 rounded-3" style={{ minWidth: '180px' }}>
      <Handle type="target" position={Position.Left} className="bg-warning p-1 border-white" />
      <div className="d-flex align-items-center gap-2">
        <div className="bg-warning text-dark p-1 rounded">
          <HelpCircle size={16} />
        </div>
        <div>
          <small className="text-warning fw-bold uppercase d-block" style={{ fontSize: '10px' }}>
            CONDITION IF/ELSE
          </small>
          <strong className="small text-dark">{String(data.label || 'Check Condition')}</strong>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="true" className="bg-success p-1 border-white" />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
ActionNode.displayName = 'ActionNode';
ConditionNode.displayName = 'ConditionNode';
