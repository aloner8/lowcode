'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Rocket,
  ShieldCheck,
  Lock,
  Headphones,
  Puzzle,
  StopCircle,
  FileText,
  Compass,
  MapPin,
  Zap,
  Timer,
  CheckCircle2,
} from 'lucide-react';
import { SubFlowCategory } from '@/types';

// ========================================================
// 1. Start Node Component (Application Entry)
// ========================================================
export const StartNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-3.5 py-2.5 rounded-3 text-white shadow-lg border border-white border-opacity-20 d-flex align-items-center gap-2.5"
      style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        minWidth: '200px',
      }}
    >
      <div className="rounded-circle bg-white bg-opacity-20 p-1.5 d-flex align-items-center justify-content-center">
        <Rocket size={18} className="text-white" />
      </div>
      <div>
        <div className="extra-small text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
          ENTRY POINT
        </div>
        <div className="fw-bold small">{String(data.label || 'Start Application')}</div>
      </div>
      <Handle type="source" position={Position.Right} className="bg-white border-2 border-primary" style={{ width: '12px', height: '12px' }} />
    </div>
  );
});
StartNode.displayName = 'StartNode';

// ========================================================
// 2. Auth Check Node Component (Session & Role Validator)
// ========================================================
export const AuthCheckNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-3.5 py-2.5 rounded-3 text-white shadow-lg border border-white border-opacity-20 d-flex align-items-center gap-2.5"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #31104b 100%)',
        minWidth: '220px',
      }}
    >
      <Handle type="target" position={Position.Left} className="bg-white border-2 border-primary" style={{ width: '12px', height: '12px' }} />
      <div className="rounded-circle bg-info bg-opacity-20 p-1.5 d-flex align-items-center justify-content-center">
        <ShieldCheck size={18} className="text-info" />
      </div>
      <div>
        <div className="extra-small text-info text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
          SECURITY VALIDATOR
        </div>
        <div className="fw-bold small">{String(data.label || 'Auth Check?')}</div>
      </div>
      <Handle type="source" position={Position.Right} className="bg-success border-2 border-white" style={{ width: '12px', height: '12px' }} />
    </div>
  );
});
AuthCheckNode.displayName = 'AuthCheckNode';

// ========================================================
// 3. Route Guard Node Component (Private / Public Router)
// ========================================================
export const RouteGuardNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-3.5 py-2.5 rounded-3 text-white shadow-lg border border-white border-opacity-20 d-flex align-items-center gap-2.5"
      style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        minWidth: '220px',
      }}
    >
      <Handle type="target" position={Position.Left} className="bg-white border-2 border-info" style={{ width: '12px', height: '12px' }} />
      <div className="rounded-circle bg-white bg-opacity-20 p-1.5 d-flex align-items-center justify-content-center">
        <Lock size={18} className="text-white" />
      </div>
      <div>
        <div className="extra-small text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
          PAGE CONTAINER ROUTER
        </div>
        <div className="fw-bold small">{String(data.label || 'Private / Public Router')}</div>
      </div>
      <Handle type="source" position={Position.Right} className="bg-white border-2 border-info" style={{ width: '12px', height: '12px' }} />
    </div>
  );
});
RouteGuardNode.displayName = 'RouteGuardNode';

// ========================================================
// 4. Event Listener Node Component (Menu + Route + Action + Timer)
// ========================================================
export const EventListenerNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-3.5 py-2.5 rounded-3 text-white shadow-lg border border-white border-opacity-20 d-flex align-items-center gap-2.5"
      style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        minWidth: '240px',
      }}
    >
      <Handle type="target" position={Position.Left} className="bg-white border-2 border-success" style={{ width: '12px', height: '12px' }} />
      <div className="rounded-circle bg-white bg-opacity-20 p-1.5 d-flex align-items-center justify-content-center">
        <Headphones size={18} className="text-white" />
      </div>
      <div>
        <div className="extra-small text-emerald-100 text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
          MASTER EVENT LOOP
        </div>
        <div className="fw-bold small">{String(data.label || 'Listening Event Loop')}</div>
        <div className="extra-small text-white-50 mt-0.5" style={{ fontSize: '0.65rem' }}>
          (Menu + Route + Action + Timer)
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="terminate" className="bg-white border-2 border-success" style={{ width: '12px', height: '12px', top: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="subflow" className="bg-warning border-2 border-white" style={{ width: '12px', height: '12px' }} />
    </div>
  );
});
EventListenerNode.displayName = 'EventListenerNode';

// ========================================================
// 5. Sub-Flow Node Component (Addable/Editable Sub-Flows)
// ========================================================
export const SubFlowNode = memo(({ data }: NodeProps) => {
  const category = (data.category as SubFlowCategory) || 'page';

  const getSubFlowBadge = () => {
    switch (category) {
      case 'page':
        return { bg: 'bg-primary bg-opacity-10 border-primary text-primary', icon: FileText, label: 'Page Sub-Flow' };
      case 'menu':
        return { bg: 'bg-info bg-opacity-10 border-info text-info', icon: Compass, label: 'Menu Sub-Flow' };
      case 'route':
        return { bg: 'bg-danger bg-opacity-10 border-danger text-danger', icon: MapPin, label: 'Route Sub-Flow' };
      case 'action':
        return { bg: 'bg-warning bg-opacity-10 border-warning text-dark', icon: Zap, label: 'Action Sub-Flow' };
      case 'timer':
        return { bg: 'bg-success bg-opacity-10 border-success text-success', icon: Timer, label: 'Timer Sub-Flow' };
      default:
        return { bg: 'bg-secondary bg-opacity-10 border-secondary text-secondary', icon: Puzzle, label: 'Sub-Flow' };
    }
  };

  const badge = getSubFlowBadge();
  const Icon = badge.icon;

  return (
    <div
      className={`px-3 py-2 rounded-3 bg-white shadow-md border-2 d-flex flex-column gap-1 cursor-pointer transition ${badge.bg}`}
      style={{ minWidth: '220px' }}
    >
      <Handle type="target" position={Position.Top} className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />
      <div className="d-flex align-items-center justify-content-between">
        <span className="badge extra-small d-flex align-items-center gap-1 border" style={{ fontSize: '0.62rem' }}>
          <Icon size={11} /> {badge.label}
        </span>
        <span className="extra-small font-monospace text-muted" style={{ fontSize: '0.62rem' }}>
          {String(data.triggerEvent || 'onTrigger')}
        </span>
      </div>
      <div className="fw-bold small text-dark mt-0.5">{String(data.label || 'Sub-Flow Handler')}</div>
      {Boolean(data.actionTarget) && (
        <div className="extra-small text-secondary font-monospace" style={{ fontSize: '0.68rem' }}>
          Action: <code>{String(data.actionTarget)}</code>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="bg-primary border-2 border-white" style={{ width: '10px', height: '10px' }} />
    </div>
  );
});
SubFlowNode.displayName = 'SubFlowNode';

// ========================================================
// 6. Close Node Component (Session Termination)
// ========================================================
export const CloseNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-3.5 py-2.5 rounded-3 text-white shadow-lg border border-white border-opacity-20 d-flex align-items-center gap-2.5"
      style={{
        background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
        minWidth: '200px',
      }}
    >
      <Handle type="target" position={Position.Left} className="bg-white border-2 border-secondary" style={{ width: '12px', height: '12px' }} />
      <div className="rounded-circle bg-danger bg-opacity-20 p-1.5 d-flex align-items-center justify-content-center">
        <StopCircle size={18} className="text-danger" />
      </div>
      <div>
        <div className="extra-small text-danger text-uppercase fw-bold" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
          TERMINATE
        </div>
        <div className="fw-bold small">{String(data.label || 'Close Session')}</div>
      </div>
    </div>
  );
});
CloseNode.displayName = 'CloseNode';
