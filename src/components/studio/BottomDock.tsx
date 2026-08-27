'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2, Database, ChevronUp, ChevronDown, Copy, Check, ScrollText, PanelBottom } from 'lucide-react';
import { ComponentNode, AppConfig } from '@/types';

interface BottomDockProps {
  appInfo: AppConfig;
  nodes: ComponentNode[];
}

type DockTab = 'summary' | 'json';

/**
 * Reference panel under the canvas.
 *
 * Two of the previous tabs printed invented content: an "Output Logs" tab of
 * hard-coded build lines that no build ever produced, and an "Audit Log Trail"
 * of two fabricated entries with fixed timestamps. Both read as real system
 * output. They are replaced by figures derived from the page actually open, and
 * a link to the real audit log.
 */
export const BottomDock: React.FC<BottomDockProps> = ({ appInfo, nodes }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<DockTab>('summary');
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(nodes, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the JSON is on screen to copy by hand.
    }
  };

  // Counts every node, not only the top level, so the figure matches the page.
  const nodeCount = useMemo(() => {
    const count = (list: ComponentNode[]): number =>
      list.reduce((total, node) => total + 1 + count(node.children ?? []), 0);
    return count(nodes);
  }, [nodes]);

  if (!isOpen) {
    return (
      <button
        type="button"
        className="stu-chrome border-top d-flex align-items-center justify-content-between w-100 px-3 py-1 border-0"
        onClick={() => setIsOpen(true)}
        aria-expanded={false}
      >
        <span className="d-flex align-items-center gap-2" style={{ fontSize: '0.78rem' }}>
          <PanelBottom size={14} aria-hidden="true" /> รายละเอียดหน้าเว็บ
        </span>
        <ChevronUp size={15} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="stu-chrome border-top d-flex flex-column" style={{ height: '220px' }}>
      <div className="px-3 py-1 border-bottom d-flex align-items-center justify-content-between" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="d-flex gap-1" role="tablist" aria-label="รายละเอียดหน้าเว็บ">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={`stu-dock-tab ${activeTab === 'summary' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <Database size={12} aria-hidden="true" /> ข้อมูลเว็บไซต์
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'json'}
            className={`stu-dock-tab ${activeTab === 'json' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            <Code2 size={12} aria-hidden="true" /> โครงสร้างหน้า
          </button>
        </div>

        <div className="d-flex align-items-center gap-2">
          {activeTab === 'json' && (
            <button type="button" className="stu-dock-tab" onClick={() => void copyJson()}>
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
          )}
          <button
            type="button"
            className="stu-dock-tab"
            onClick={() => setIsOpen(false)}
            aria-label="ย่อแผงรายละเอียด"
            aria-expanded
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-3 overflow-auto flex-grow-1" style={{ fontSize: '0.8rem' }}>
        {activeTab === 'summary' && (
          <dl className="adm-facts" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>เว็บไซต์</dt>
              <dd style={{ color: '#fff' }}>{appInfo.appName}</dd>
            </div>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>ส่วนประกอบในหน้านี้</dt>
              <dd style={{ color: '#fff' }}>{nodeCount} ชิ้น</dd>
            </div>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>ที่อยู่เว็บ</dt>
              <dd><code>{appInfo.subdomain}</code></dd>
            </div>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>พอร์ต</dt>
              <dd><code>{appInfo.port}</code></dd>
            </div>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>ฐานข้อมูล</dt>
              <dd><code>{appInfo.tenantDbName}</code></dd>
            </div>
            <div>
              <dt style={{ color: 'rgba(255,255,255,0.6)' }}>ธีม</dt>
              <dd><code>{appInfo.themeConfig?.preset ?? '—'}</code></dd>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Link href="/audit-logs" className="stu-dock-tab" style={{ paddingInline: 0 }}>
                <ScrollText size={13} aria-hidden="true" /> ดูประวัติการเปลี่ยนแปลงทั้งหมด →
              </Link>
            </div>
          </dl>
        )}

        {activeTab === 'json' && (
          <pre className="m-0 font-monospace" style={{ fontSize: '0.74rem', color: '#cfe4ff' }}>
            {JSON.stringify(nodes, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
