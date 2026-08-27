'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Save,
  Download,
  Eye,
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
} from 'lucide-react';
import { AppConfig } from '@/types';

interface StudioMenuBarProps {
  appInfo: AppConfig;
  onSave: () => void;
  onDownloadJson: () => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (val: boolean) => void;
  saveStatus: string | null;
  children?: React.ReactNode;
}

/**
 * Menu bar for the editor.
 *
 * The brand link, the signed-in user and the sign-out control used to live here
 * too; they now sit in the console shell that wraps every screen, so repeating
 * them put the same three things on screen twice. The "Core DB Online" pill was
 * also removed — it was hard-coded green and never checked anything.
 */
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
  const barRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (menu: string) => setOpenMenu(openMenu === menu ? null : menu);
  const closeMenus = () => setOpenMenu(null);

  // An open menu should close on Escape or on a click anywhere else.
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeMenus();
    const onClick = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) closeMenus();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [openMenu]);

  const menuButton = (id: string, label: string, Icon: typeof FileText) => (
    <button
      type="button"
      className={`stu-menu-btn ${openMenu === id ? 'is-open' : ''}`}
      onClick={() => toggleMenu(id)}
      aria-expanded={openMenu === id}
      aria-haspopup="menu"
    >
      <Icon size={15} aria-hidden="true" />
      <span className="d-none d-md-inline">{label}</span>
    </button>
  );

  return (
    <div
      ref={barRef}
      className="stu-chrome px-2 py-1 border-bottom d-flex align-items-center justify-content-between gap-2 text-nowrap"
    >
      <div className="d-flex align-items-center gap-1">
        <div className="position-relative">
          {menuButton('file', 'ไฟล์', FileText)}
          {openMenu === 'file' && (
            <div className="stu-dropdown position-absolute py-1 mt-1 z-3" style={{ minWidth: '15rem', left: 0 }} role="menu">
              <button type="button" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={() => { onSave(); closeMenus(); }}>
                <Save size={14} aria-hidden="true" /> บันทึกหน้าเว็บ
              </button>
              <button type="button" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={() => { onDownloadJson(); closeMenus(); }}>
                <Download size={14} aria-hidden="true" /> ส่งออกโครงสร้าง (JSON)
              </button>
              <hr className="dropdown-divider my-1 opacity-25" />
              <Link href="/admin/apps" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={closeMenus}>
                <Folder size={14} aria-hidden="true" /> ไปที่รายการเว็บไซต์
              </Link>
            </div>
          )}
        </div>

        <div className="position-relative">
          {menuButton('edit', 'แก้ไข', Pencil)}
          {openMenu === 'edit' && (
            <div className="stu-dropdown position-absolute py-1 mt-1 z-3" style={{ minWidth: '15rem', left: 0 }} role="menu">
              <button type="button" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={closeMenus}>
                <Undo2 size={14} aria-hidden="true" /> ย้อนกลับ <kbd className="ms-auto">Ctrl+Z</kbd>
              </button>
              <button type="button" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={closeMenus}>
                <Redo2 size={14} aria-hidden="true" /> ทำซ้ำ <kbd className="ms-auto">Ctrl+Y</kbd>
              </button>
            </div>
          )}
        </div>

        <div className="position-relative">
          {menuButton('view', 'มุมมอง', PanelsTopLeft)}
          {openMenu === 'view' && (
            <div className="stu-dropdown position-absolute py-1 mt-1 z-3" style={{ minWidth: '15rem', left: 0 }} role="menu">
              <button
                type="button"
                className="dropdown-item d-flex align-items-center gap-2 px-3 py-2"
                onClick={() => { setIsPreviewMode(!isPreviewMode); closeMenus(); }}
              >
                <Eye size={14} aria-hidden="true" />
                {isPreviewMode ? 'ออกจากการดูตัวอย่าง' : 'ดูตัวอย่างหน้าเว็บ'}
              </button>
            </div>
          )}
        </div>

        <div className="position-relative">
          {menuButton('project', 'เว็บไซต์นี้', BriefcaseBusiness)}
          {openMenu === 'project' && (
            <div className="stu-dropdown position-absolute py-1 mt-1 z-3" style={{ minWidth: '17rem', left: 0 }}>
              <div className="px-3 py-2">
                <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>{appInfo.appName}</div>
                <div className="small opacity-75 font-monospace">{appInfo.appSlug}</div>
                <hr className="dropdown-divider my-2 opacity-25" />
                <div className="small opacity-75">พอร์ต <code>{appInfo.port}</code></div>
                <div className="small opacity-75">ฐานข้อมูล <code>{appInfo.tenantDbName}</code></div>
                <div className="small opacity-75">ธีม <code>{appInfo.themeConfig?.preset ?? '—'}</code></div>
              </div>
            </div>
          )}
        </div>

        <div className="position-relative">
          {menuButton('tools', 'เครื่องมือ', Wrench)}
          {openMenu === 'tools' && (
            <div className="stu-dropdown position-absolute py-1 mt-1 z-3" style={{ minWidth: '15rem', left: 0 }} role="menu">
              <Link href="/flow-studio" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={closeMenus}>
                <Workflow size={14} aria-hidden="true" /> ออกแบบขั้นตอนงาน
              </Link>
              <Link href="/audit-logs" className="dropdown-item d-flex align-items-center gap-2 px-3 py-2" onClick={closeMenus}>
                <ScrollText size={14} aria-hidden="true" /> ประวัติการใช้งาน
              </Link>
            </div>
          )}
        </div>
      </div>

      {children && <div className="d-flex align-items-center flex-grow-1 overflow-auto">{children}</div>}

      {saveStatus && (
        <span className="stu-status is-ok flex-shrink-0" role="status">{saveStatus}</span>
      )}
    </div>
  );
};
