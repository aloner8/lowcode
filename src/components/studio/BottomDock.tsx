'use client';

import React, { useState } from 'react';
import { ComponentNode, AppConfig } from '@/types';
import { Terminal, Code2, Database, Activity, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';

interface BottomDockProps {
  appInfo: AppConfig;
  nodes: ComponentNode[];
}

export const BottomDock: React.FC<BottomDockProps> = ({ appInfo, nodes }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeDockTab, setActiveDockTab] = useState<'output' | 'json' | 'db' | 'audit'>('output');
  const [copied, setCopied] = useState(false);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(nodes, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return (
      <div
        className="bg-dark text-white p-1 px-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between cursor-pointer hover-bg-secondary select-none"
        onClick={() => setIsOpen(true)}
        style={{ fontSize: '0.75rem', background: '#1e1e1e' }}
      >
        <div className="d-flex align-items-center gap-2">
          <Terminal size={13} className="text-info" />
          <span className="fw-semibold">VS Output & Diagnostics Dock</span>
          <span className="badge bg-secondary bg-opacity-30 text-white-50 extra-small">Click to expand</span>
        </div>
        <ChevronUp size={14} className="text-white-50" />
      </div>
    );
  }

  return (
    <div
      className="bg-dark text-white border-top border-secondary border-opacity-25 d-flex flex-column"
      style={{ background: '#1e1e1e', height: '220px', transition: 'all 0.2s ease' }}
    >
      {/* Dock Header & Tabs */}
      <div className="px-3 py-1 bg-black bg-opacity-30 border-bottom border-secondary border-opacity-20 d-flex align-items-center justify-content-between">
        <ul className="nav nav-pills flex-nowrap gap-1 mb-0">
          <li className="nav-item">
            <button
              className={`nav-link py-0.5 px-2.5 extra-small border-0 rounded-1 d-flex align-items-center gap-1.5 ${
                activeDockTab === 'output' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-white-50 hover-bg-secondary'
              }`}
              onClick={() => setActiveDockTab('output')}
              style={{ fontSize: '0.72rem' }}
            >
              <Terminal size={12} className={activeDockTab === 'output' ? 'text-white' : 'text-info'} />
              <span>Output Logs</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-0.5 px-2.5 extra-small border-0 rounded-1 d-flex align-items-center gap-1.5 ${
                activeDockTab === 'json' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-white-50 hover-bg-secondary'
              }`}
              onClick={() => setActiveDockTab('json')}
              style={{ fontSize: '0.72rem' }}
            >
              <Code2 size={12} className={activeDockTab === 'json' ? 'text-white' : 'text-success'} />
              <span>Live AST JSON</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-0.5 px-2.5 extra-small border-0 rounded-1 d-flex align-items-center gap-1.5 ${
                activeDockTab === 'db' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-white-50 hover-bg-secondary'
              }`}
              onClick={() => setActiveDockTab('db')}
              style={{ fontSize: '0.72rem' }}
            >
              <Database size={12} className={activeDockTab === 'db' ? 'text-white' : 'text-warning'} />
              <span>Tenant DB Status</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link py-0.5 px-2.5 extra-small border-0 rounded-1 d-flex align-items-center gap-1.5 ${
                activeDockTab === 'audit' ? 'bg-primary text-white fw-bold shadow-sm' : 'text-white-50 hover-bg-secondary'
              }`}
              onClick={() => setActiveDockTab('audit')}
              style={{ fontSize: '0.72rem' }}
            >
              <Activity size={12} className={activeDockTab === 'audit' ? 'text-white' : 'text-info'} />
              <span>Audit Log Trail</span>
            </button>
          </li>
        </ul>

        <div className="d-flex align-items-center gap-2">
          {activeDockTab === 'json' && (
            <button className="btn btn-sm btn-outline-light py-0 px-2 extra-small d-flex align-items-center gap-1" onClick={copyJson} style={{ fontSize: '0.68rem' }}>
              {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>
          )}
          <button className="btn btn-sm btn-dark p-0.5 text-white-50 hover-text-white border-0" onClick={() => setIsOpen(false)}>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="p-3 font-monospace overflow-auto flex-grow-1 extra-small text-light" style={{ fontSize: '0.74rem', lineHeight: '1.45' }}>
        {activeDockTab === 'output' && (
          <div>
            <div className="text-success">[BUILD ENGINE] Visual Studio 2022 Low-Code Environment Ready.</div>
            <div className="text-white-50">[TENANT RUNTIME] App: {appInfo.appName} ({appInfo.appSlug}) | Port: :{appInfo.port}</div>
            <div className="text-info">[AST PARSER] 2 Component Nodes loaded successfully on Form Stage.</div>
            <div className="text-white-50">[DB WATCHER] Connected to PostgreSQL Core DB Schema.</div>
          </div>
        )}

        {activeDockTab === 'json' && (
          <pre className="m-0 text-info font-monospace">{JSON.stringify(nodes, null, 2)}</pre>
        )}

        {activeDockTab === 'db' && (
          <div>
            <div className="text-warning mb-1">Database Connection Metrics:</div>
            <div>Tenant Database: <code>{appInfo.tenantDbName}</code></div>
            <div>Port Binding: <code>:{appInfo.port}</code> (Docker Internal Container)</div>
            <div>Subdomain Mapping: <code>{appInfo.subdomain}</code></div>
          </div>
        )}

        {activeDockTab === 'audit' && (
          <div className="d-flex flex-column gap-1">
            <div className="text-muted">13:29:45 - USER @admin updated theme to {appInfo.themeConfig.preset}</div>
            <div className="text-muted">13:25:10 - USER @admin created tenant child app on port :{appInfo.port}</div>
          </div>
        )}
      </div>
    </div>
  );
};
