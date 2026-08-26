'use client';

import React, { useState } from 'react';
import { Braces, FileText, Link2, Puzzle, Settings, Workflow, Zap } from 'lucide-react';
import type { AppRoute } from '@/types';

type TabId = 'properties' | 'page' | 'events' | 'services' | 'apis';

interface Props {
  route: AppRoute;
  pageName?: string;
  onClose: () => void;
  onOpenPage?: () => void;
  onOpenFlow: () => void;
}

export const SiteMapNodePropertyPage: React.FC<Props> = ({ route, pageName, onClose, onOpenPage, onOpenFlow }) => {
  const [activeTab, setActiveTab] = useState<TabId>('properties');
  const tabs = [
    { id: 'properties' as const, label: 'Properties', icon: Settings },
    { id: 'page' as const, label: route.targetType === 'form' ? 'Form' : 'Page', icon: FileText },
    { id: 'events' as const, label: 'Events', icon: Workflow },
    { id: 'services' as const, label: 'Services', icon: Puzzle },
    { id: 'apis' as const, label: 'APIs', icon: Braces },
  ];
  return <div className="card border-0 shadow-sm h-100">
    <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center p-3">
      <div><div className="small text-info fw-bold text-uppercase">{route.targetType} · Site Map Node</div><h5 className="mb-0">{route.label}</h5><code className="text-warning">{route.path}</code></div>
      <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
    </div>
    <div className="nav nav-tabs bg-light px-3 pt-2">{tabs.map((tab) => <button key={tab.id} className={`nav-link d-flex align-items-center gap-1 ${activeTab === tab.id ? 'active fw-bold' : ''}`} onClick={() => setActiveTab(tab.id)}><tab.icon size={13}/>{tab.label}</button>)}</div>
    <div className="card-body overflow-auto p-4">
      {activeTab === 'properties' && <div className="row g-3">
        {[['Node ID', route.id], ['Node Type', route.targetType], ['Label', route.label], ['Path', route.path], ['Target ID', route.targetId || 'Not assigned'], ['Container', route.containerName], ['Permission', route.permission || 'Public / inherited']].map(([label, value]) => <div className="col-md-6" key={label}><label className="form-label small fw-bold text-secondary">{label}</label><div className="form-control bg-light font-monospace small">{value}</div></div>)}
      </div>}
      {activeTab === 'page' && <div><h5>{route.targetType === 'form' ? 'Form Target' : 'Page Target'}</h5><p className="text-muted">{pageName || route.targetId || 'Node นี้ยังไม่ได้ผูก target'}</p><button className="btn btn-primary" disabled={!onOpenPage} onClick={onOpenPage}><FileText size={14} className="me-1"/>Open {route.targetType === 'form' ? 'Form' : 'Page'} Designer</button></div>}
      {activeTab === 'events' && <div><h5>Node Events</h5><p className="text-muted">Workflow เช่น OnLoad, Click และ Navigate ถูกจัดการในแท็บนี้</p><button className="btn btn-warning" onClick={onOpenFlow}><Zap size={14} className="me-1"/>Open Event Flow</button></div>}
      {activeTab === 'services' && <div><h5>Assigned Services</h5><p className="text-muted">ยังไม่มี Service binding สำหรับ Node นี้</p><button className="btn btn-outline-primary" onClick={onOpenFlow}><Link2 size={14} className="me-1"/>Add Service Binding</button></div>}
      {activeTab === 'apis' && <div><h5>API Bindings</h5><p className="text-muted">ยังไม่มี API call สำหรับ Node นี้</p><button className="btn btn-outline-info" onClick={onOpenFlow}><Braces size={14} className="me-1"/>Add API Call</button></div>}
    </div>
  </div>;
};
