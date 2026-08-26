'use client';

import React, { useState } from 'react';
import { AppConfig } from '@/types';
import { Folder, FileText, Database, Palette, ChevronDown, ChevronRight, Layers, FileCode, CheckCircle2 } from 'lucide-react';

interface ProjectExplorerProps {
  appInfo: AppConfig;
  activePage: string;
  setActivePage: (page: string) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ appInfo, activePage, setActivePage }) => {
  const [openFolderPages, setOpenFolderPages] = useState(true);
  const [openFolderNav, setOpenFolderNav] = useState(true);
  const [openFolderDb, setOpenFolderDb] = useState(false);
  const [openFolderTheme, setOpenFolderTheme] = useState(false);

  const pages = [
    { id: 'index', name: 'Home (index.page)', active: activePage === 'index' },
    { id: 'about', name: 'AboutUs (about.page)', active: activePage === 'about' },
    { id: 'services', name: 'Services (services.page)', active: activePage === 'services' },
  ];

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white h-100">
      <div className="card-header bg-light border-bottom py-2 px-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-1.5">
          <Layers size={15} className="text-primary" />
          <h6 className="fw-bold mb-0 text-dark extra-small text-uppercase" style={{ letterSpacing: '0.04em' }}>
            Solution Explorer
          </h6>
        </div>
        <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small" style={{ fontSize: '0.62rem' }}>
          Solution &apos;App&apos; (1 Project)
        </span>
      </div>

      <div className="card-body p-2 overflow-auto select-none" style={{ fontSize: '0.78rem' }}>
        {/* Solution Root Item */}
        <div className="fw-bold text-dark d-flex align-items-center gap-1.5 mb-1 text-truncate">
          <Folder size={15} className="text-warning fill-warning" />
          <span>Solution &apos;{appInfo.appName}&apos;</span>
        </div>

        <div className="ms-2 ps-2 border-start border-light">
          {/* Project Item */}
          <div className="fw-semibold text-primary d-flex align-items-center gap-1.5 py-0.5">
            <FileCode size={14} className="text-primary" />
            <span>{appInfo.appSlug}.proj (Port :{appInfo.port})</span>
          </div>

          <div className="ms-2.5 ps-2 border-start border-light">
            {/* Pages Folder */}
            <div
              className="d-flex align-items-center gap-1 py-0.5 text-secondary cursor-pointer hover-text-primary"
              onClick={() => setOpenFolderPages(!openFolderPages)}
            >
              {openFolderPages ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Folder size={14} className="text-warning" />
              <span className="fw-medium text-dark">Pages Layouts</span>
            </div>
            {openFolderPages && (
              <div className="ms-3">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    className={`d-flex align-items-center gap-1.5 px-2 py-1 rounded-1 cursor-pointer my-0.5 ${
                      p.active ? 'bg-primary text-white fw-bold shadow-sm' : 'text-secondary hover-bg-light'
                    }`}
                    onClick={() => setActivePage(p.id)}
                    style={{ fontSize: '0.74rem' }}
                  >
                    <FileText size={13} className={p.active ? 'text-white' : 'text-info'} />
                    <span>{p.name}</span>
                    {p.active && <CheckCircle2 size={11} className="ms-auto text-white" />}
                  </div>
                ))}
              </div>
            )}

            {/* Navigation Folder */}
            <div
              className="d-flex align-items-center gap-1 py-0.5 text-secondary cursor-pointer hover-text-primary mt-1"
              onClick={() => setOpenFolderNav(!openFolderNav)}
            >
              {openFolderNav ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Folder size={14} className="text-warning" />
              <span className="fw-medium text-dark">Navigation & Menus</span>
            </div>
            {openFolderNav && (
              <div className="ms-3">
                <div className="text-secondary extra-small px-2 py-0.5 d-flex align-items-center gap-1.5">
                  <FileText size={12} className="text-secondary" />
                  <span>main_header.nav</span>
                </div>
                <div className="text-secondary extra-small px-2 py-0.5 d-flex align-items-center gap-1.5">
                  <FileText size={12} className="text-secondary" />
                  <span>sidebar_drawer.nav</span>
                </div>
              </div>
            )}

            {/* Tenant Database Folder */}
            <div
              className="d-flex align-items-center gap-1 py-0.5 text-secondary cursor-pointer hover-text-primary mt-1"
              onClick={() => setOpenFolderDb(!openFolderDb)}
            >
              {openFolderDb ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Database size={14} className="text-info" />
              <span className="fw-medium text-dark">Tenant Database Schema</span>
            </div>
            {openFolderDb && (
              <div className="ms-3 font-monospace extra-small text-muted">
                <div className="px-2 py-0.5"><code>{appInfo.tenantDbName}.users</code></div>
                <div className="px-2 py-0.5"><code>{appInfo.tenantDbName}.form_data</code></div>
              </div>
            )}

            {/* Theme System Folder */}
            <div
              className="d-flex align-items-center gap-1 py-0.5 text-secondary cursor-pointer hover-text-primary mt-1"
              onClick={() => setOpenFolderTheme(!openFolderTheme)}
            >
              {openFolderTheme ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Palette size={14} className="text-success" />
              <span className="fw-medium text-dark">Theme Tokens</span>
            </div>
            {openFolderTheme && (
              <div className="ms-3 text-secondary extra-small">
                <div className="px-2 py-0.5">Preset: {appInfo.themeConfig.preset}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
