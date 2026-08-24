'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  User,
  Globe,
  Zap,
  Server,
  Database,
  FileCode,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { LifelineParticipant, SequenceMessageType } from '@/types';

// ========================================================
// 1. Swimlane Lifeline Header Node Component
// ========================================================
export const LifelineHeaderNode = memo(({ data }: NodeProps) => {
  const participant = (data.participant as LifelineParticipant) || 'user';

  const getHeaderDetails = () => {
    switch (participant) {
      case 'user':
        return { label: '1. User', bg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', icon: User };
      case 'browser':
        return { label: '2. Browser', bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', icon: Globe };
      case 'api':
        return { label: '3. API', bg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', icon: Zap };
      case 'server':
        return { label: '4. Server', bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)', icon: Server };
      case 'db':
        return { label: '5. DB', bg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', icon: Database };
      case 'file':
        return { label: '6. File', bg: 'linear-gradient(135deg, #475569 0%, #334155 100%)', icon: FileCode };
      default:
        return { label: 'Participant', bg: 'linear-gradient(135deg, #475569 0%, #334155 100%)', icon: User };
    }
  };

  const details = getHeaderDetails();
  const Icon = details.icon;

  return (
    <div
      className="px-4 py-2.5 rounded-3 text-white shadow-md border border-white border-opacity-20 d-flex align-items-center justify-content-center gap-2 select-none"
      style={{
        background: details.bg,
        width: '180px',
      }}
    >
      <Icon size={18} className="text-white flex-shrink-0" />
      <span className="fw-bold small text-nowrap">{details.label}</span>
    </div>
  );
});
LifelineHeaderNode.displayName = 'LifelineHeaderNode';

// ========================================================
// 2. Sequence Step Node Component
// ========================================================
export const SequenceStepNode = memo(({ data }: NodeProps) => {
  const messageType = (data.messageType as SequenceMessageType) || 'request';
  const sourceLifeline = (data.sourceLifeline as LifelineParticipant) || 'user';
  const targetLifeline = (data.targetLifeline as LifelineParticipant) || 'browser';

  const getMessageBadge = () => {
    switch (messageType) {
      case 'request':
        return { bg: 'bg-primary text-white', label: 'Request →' };
      case 'response':
        return { bg: 'bg-success text-white', label: '← Response' };
      case 'async':
        return { bg: 'bg-warning text-dark', label: '↺ Async Event' };
      case 'decision':
        return { bg: 'bg-danger text-white', label: '? Decision' };
      default:
        return { bg: 'bg-secondary text-white', label: 'Message' };
    }
  };

  const badge = getMessageBadge();

  return (
    <div
      className="px-3 py-2 rounded-3 bg-white shadow-md border-2 border-primary d-flex flex-column gap-1 select-none transition hover-shadow cursor-pointer"
      style={{ width: '220px' }}
    >
      <Handle type="target" position={Position.Left} id="left-target" className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />
      <Handle type="target" position={Position.Top} id="top-target" className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />

      <div className="d-flex align-items-center justify-content-between">
        <span className="badge bg-dark text-white rounded-circle font-monospace extra-small" style={{ width: '20px', height: '20px', lineHeight: '14px' }}>
          #{String(data.stepNumber || 1)}
        </span>
        <span className={`badge extra-small ${badge.bg}`} style={{ fontSize: '0.62rem' }}>
          {badge.label}
        </span>
      </div>

      <div className="fw-bold extra-small text-dark mt-0.5 lh-sm">{String(data.label || 'Sequence Step')}</div>

      <div className="extra-small text-muted font-monospace d-flex align-items-center justify-content-between border-top pt-1 mt-1" style={{ fontSize: '0.65rem' }}>
        <span className="text-uppercase">{String(sourceLifeline)}</span>
        <ArrowRight size={12} className="text-primary" />
        <span className="text-uppercase">{String(targetLifeline)}</span>
      </div>

      <Handle type="source" position={Position.Right} id="right-source" className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />
    </div>
  );
});
SequenceStepNode.displayName = 'SequenceStepNode';
