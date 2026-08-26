'use client';

import React, { useState } from 'react';
import { AppConfig } from '@/types';
import {
  Save,
  Download,
  Eye,
  Sparkles,
  Folder,
  FileText,
  Pencil,
  PanelsTopLeft,
  BriefcaseBusiness,
  Wrench,
  Undo2,
  Redo2,
  Workflow,
  ScrollText,
  CircleUserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useStudioUser } from './StudioUserContext';

interface StudioMenuBarProps {
  appInfo: AppConfig;
  onSave: () => void;
  onDownloadJson: () => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (val: boolean) => void;
  saveStatus: string | null;
  children?: React.ReactNode;
}

export const StudioMenuBar: React.FC<StudioMenuBarProps> = ({
  appInfo,
  onSave,
  onDownloadJson,
  isPreviewMode,
  setIsPreviewMode,
  saveStatus,
  children,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const user = useStudioUser();

  const toggleMenu = (menu: string) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenus = () => setOpenMenu(null);

  return (
    <div
      className="bg-dark text-white px-2 py-1 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between text-nowrap select-none"
      style={{ background: '#1e1e1e', fontSize: '0.78rem' }}
    >
      {/* Brand Icon & Main Menu Bar */}
      <div className="d-flex align-items-center gap-1">
        <Link href="/admin" className="d-flex align-items-center gap-1.5 text-white text-decoration-none px-2 py-1 me-2 hover-bg-dark rounded-1">
          <div
            className="d-flex align-items-center justify-content-center text-white shadow-sm"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '0.35rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            }}
          >
            <Sparkles size={12} />
          </div>
          <span className="fw-bold extra-small">Platform Admin <span className="text-white-50 fw-normal">({appInfo.appName})</span></span>
        </Link>

        <span className="bg-secondary opacity-25 mx-1" style={{ width: '1px', height: '20px' }} />

        {/* Dropdown Menus */}
        <div className="position-relative">
          <button
            className={`btn btn-sm d-flex align-items-center justify-content-center text-white border-0 rounded-2 ${openMenu === 'file' ? 'bg-primary shadow-sm' : 'hover-bg-secondary'}`}
            onClick={() => toggleMenu('file')}
            title="File"
            aria-label="File menu"
            aria-expanded={openMenu === 'file'}
            style={{ width: '30px', height: '30px' }}
          >
            <FileText size={16} />
          </button>
          {openMenu === 'file' && (
            <div className="position-absolute bg-dark text-white rounded-2 shadow-lg py-1 border border-secondary border-opacity-25 mt-1 z-3" style={{ minWidth: '180px', left: 0 }}>
              <button className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={() => { onSave(); closeMenus(); }}>
                <Save size={13} className="text-primary" /> Save Form Layout
              </button>
              <button className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={() => { onDownloadJson(); closeMenus(); }}>
                <Download size={13} className="text-info" /> Export AST JSON
              </button>
              <hr className="dropdown-divider border-secondary my-1 opacity-25" />
              <Link href="/admin/apps" className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={closeMenus}>
                <Folder size={13} className="text-warning" /> Manage All Tenant Apps
              </Link>
            </div>
          )}
        </div>

        <div className="position-relative">
          <button
            className={`btn btn-sm d-flex align-items-center justify-content-center text-white border-0 rounded-2 ${openMenu === 'edit' ? 'bg-primary shadow-sm' : 'hover-bg-secondary'}`}
            onClick={() => toggleMenu('edit')}
            title="Edit"
            aria-label="Edit menu"
            aria-expanded={openMenu === 'edit'}
            style={{ width: '30px', height: '30px' }}
          >
            <Pencil size={16} />
          </button>
          {openMenu === 'edit' && (
            <div className="position-absolute bg-dark text-white rounded-2 shadow-lg py-1 border border-secondary border-opacity-25 mt-1 z-3" style={{ minWidth: '180px', left: 0 }}>
              <button className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={closeMenus}>
                <Undo2 size={13} className="text-info" /> Undo (Ctrl+Z)
              </button>
              <button className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={closeMenus}>
                <Redo2 size={13} className="text-info" /> Redo (Ctrl+Y)
              </button>
            </div>
          )}
        </div>

        <div className="position-relative">
          <button
            className={`btn btn-sm d-flex align-items-center justify-content-center text-white border-0 rounded-2 ${openMenu === 'view' ? 'bg-primary shadow-sm' : 'hover-bg-secondary'}`}
            onClick={() => toggleMenu('view')}
            title="View"
            aria-label="View menu"
            aria-expanded={openMenu === 'view'}
            style={{ width: '30px', height: '30px' }}
          >
            <PanelsTopLeft size={16} />
          </button>
          {openMenu === 'view' && (
            <div className="position-absolute bg-dark text-white rounded-2 shadow-lg py-1 border border-secondary border-opacity-25 mt-1 z-3" style={{ minWidth: '180px', left: 0 }}>
              <button className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={() => { setIsPreviewMode(!isPreviewMode); closeMenus(); }}>
                <Eye size={13} className="text-success" /> Toggle Live Preview
              </button>
            </div>
          )}
        </div>

        <div className="position-relative">
          <button
            className={`btn btn-sm d-flex align-items-center justify-content-center text-white border-0 rounded-2 ${openMenu === 'project' ? 'bg-primary shadow-sm' : 'hover-bg-secondary'}`}
            onClick={() => toggleMenu('project')}
            title="Project"
            aria-label="Project information"
            aria-expanded={openMenu === 'project'}
            style={{ width: '30px', height: '30px' }}
          >
            <BriefcaseBusiness size={16} />
          </button>
          {openMenu === 'project' && (
            <div className="position-absolute bg-dark text-white rounded-2 shadow-lg py-1 border border-secondary border-opacity-25 mt-1 z-3" style={{ minWidth: '220px', left: 0 }}>
              <div className="px-3 py-1 text-white-50 extra-small fw-bold">Active App: {appInfo.appName}</div>
              <div className="px-3 py-0.5 text-info extra-small font-monospace">Port: :{appInfo.port}</div>
              <div className="px-3 py-0.5 text-warning extra-small font-monospace">DB: {appInfo.tenantDbName}</div>
            </div>
          )}
        </div>

        <div className="position-relative">
          <button
            className={`btn btn-sm d-flex align-items-center justify-content-center text-white border-0 rounded-2 ${openMenu === 'tools' ? 'bg-primary shadow-sm' : 'hover-bg-secondary'}`}
            onClick={() => toggleMenu('tools')}
            title="Tools"
            aria-label="Tools menu"
            aria-expanded={openMenu === 'tools'}
            style={{ width: '30px', height: '30px' }}
          >
            <Wrench size={16} />
          </button>
          {openMenu === 'tools' && (
            <div className="position-absolute bg-dark text-white rounded-2 shadow-lg py-1 border border-secondary border-opacity-25 mt-1 z-3" style={{ minWidth: '180px', left: 0 }}>
              <Link href="/flow-studio" className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={closeMenus}>
                <Workflow size={13} className="text-info" /> Open Flow Studio
              </Link>
              <Link href="/audit-logs" className="dropdown-item text-white extra-small px-3 py-1.5 hover-bg-primary d-flex align-items-center gap-2" onClick={closeMenus}>
                <ScrollText size={13} className="text-warning" /> Audit Trail Logs
              </Link>
            </div>
          )}
        </div>
      </div>

      {children && <div className="d-flex align-items-center flex-grow-1 ms-3 overflow-auto">{children}</div>}

      {/* System status, app identifier and signed-in user share the same Studio bar. */}
      <div className="d-flex align-items-center gap-3">
        {saveStatus && (
          <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 extra-small px-2 py-0.5">
            {saveStatus}
          </span>
        )}
        <div className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-2 border border-success border-opacity-25 bg-success bg-opacity-10" title="Core database is online">
          <span className="rounded-circle bg-success" style={{ width: 8, height: 8, boxShadow: '0 0 0 3px rgba(25,135,84,.18)' }} />
          <span className="text-success small fw-semibold">Core DB Online</span>
        </div>
        <span className="bg-secondary opacity-25" style={{ width: 1, height: 26 }} />
        <Link href="/admin" className="d-flex align-items-center gap-2 text-white text-decoration-none" title="Back to Platform Control Admin">
          <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 30, height: 30, background: user?.globalRole === 'GOD' ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
            {user?.username?.[0]?.toUpperCase() || user?.fullName?.[0]?.toUpperCase() || <CircleUserRound size={16}/>} 
          </div>
          <div className="d-none d-lg-block lh-sm">
            <div className="small fw-semibold">{user?.fullName || user?.username || 'Studio User'}</div>
            <div className="text-white-50" style={{ fontSize: '.65rem' }}>{user?.globalRole === 'GOD' ? 'Super Admin' : 'Platform Developer'}</div>
          </div>
        </Link>
      </div>
    </div>
  );
};
