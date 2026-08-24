'use client';

import React from 'react';
import { Layout, Menu as MenuIcon, Code2, Palette, Database, Layers } from 'lucide-react';

export type StudioTabModule = 'canvas' | 'menus' | 'ast' | 'theme' | 'data';

interface StudioModuleNavProps {
  activeTab: StudioTabModule;
  setActiveTab: (tab: StudioTabModule) => void;
}

export const StudioModuleNav: React.FC<StudioModuleNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'canvas' as StudioTabModule, label: 'Canvas Designer', icon: Layout, badge: 'Visual Builder' },
    { id: 'menus' as StudioTabModule, label: 'Navigation & Menus', icon: MenuIcon, badge: 'Next Module' },
    { id: 'ast' as StudioTabModule, label: 'Page AST & Schema', icon: Code2 },
    { id: 'theme' as StudioTabModule, label: 'Theme Engine', icon: Palette },
    { id: 'data' as StudioTabModule, label: 'Tenant DB Bindings', icon: Database },
  ];

  return (
    <div className="bg-white rounded-3 shadow-sm p-1.5 mb-3 border d-flex align-items-center justify-content-between overflow-auto">
      <ul className="nav nav-pills flex-nowrap gap-1 mb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <li className="nav-item text-nowrap" key={tab.id}>
              <button
                className={`nav-link d-flex align-items-center gap-2 px-3 py-1.5 rounded-2 extra-small fw-medium ${
                  isActive ? 'bg-primary text-white shadow-sm' : 'text-secondary hover-light'
                }`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: '0.78rem',
                  transition: 'all 0.15s ease',
                  background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : undefined,
                }}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-primary'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`badge ms-1 ${
                      isActive ? 'bg-white bg-opacity-25 text-white' : 'bg-secondary bg-opacity-10 text-secondary'
                    }`}
                    style={{ fontSize: '0.58rem', padding: '0.12rem 0.35rem' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="d-none d-md-flex align-items-center gap-2 pe-2 text-muted extra-small" style={{ fontSize: '0.72rem' }}>
        <Layers size={13} className="text-info" />
        <span>Design Mode v1.2</span>
      </div>
    </div>
  );
};
