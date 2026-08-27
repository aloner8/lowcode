'use client';

import React, { useState } from 'react';
import { Save, Play, RotateCcw, RotateCw, Download, Monitor, Tablet, Smartphone, Grid, FileText, Box, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import { AppConfig } from '@/types';

interface StudioToolBarProps {
  appInfo: AppConfig;
  onSave: () => void;
  onDownloadJson: () => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (val: boolean) => void;
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  setViewportMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  activePageSlug: string;
  onOpenPageManager: () => void;
  platformId?: string | null;
  activeSurface: 'frontend' | 'backend';
  setActiveSurface: (surface: 'frontend' | 'backend') => void;
  compactTop?: boolean;
}

interface PlatformRuntimeStatus {
  dockerConnected: boolean; exists: boolean; stale: boolean; status: string;
  runtimePath: string; image: string | null; containerName: string | null;
  buildRevision: string | null; builtAt: string | null; sourceUpdatedAt: string;
  port: number | null; url: string | null; error: string | null;
  surfaces: Record<string, { containerName: string; port: number | null; url: string | null }>;
}

export const StudioToolBar: React.FC<StudioToolBarProps> = ({
  appInfo,
  onSave,
  onDownloadJson,
  isPreviewMode,
  setIsPreviewMode: _setIsPreviewMode,
  viewportMode,
  setViewportMode,
  showGrid,
  setShowGrid,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoomLevel,
  setZoomLevel,
  activePageSlug,
  onOpenPageManager,
  platformId,
  activeSurface,
  setActiveSurface,
  compactTop = false,
}) => {
  const zoomLevels = [50, 75, 100, 125, 150];
  const [runtimeStatus, setRuntimeStatus] = useState<PlatformRuntimeStatus | null>(null);
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const inspectRuntime = async () => {
    setRuntimeModalOpen(true);
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      if (!platformId) throw new Error('ไม่พบ Platform ID');
      const response = await fetch(`/api/platforms/${platformId}/runtime`, { cache: 'no-store' });
      const data = await response.json() as { runtime?: PlatformRuntimeStatus; error?: string };
      if (!response.ok || !data.runtime) throw new Error(data.error || 'ตรวจสอบ Docker Runtime ไม่สำเร็จ');
      setRuntimeStatus(data.runtime);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'ตรวจสอบ Docker Runtime ไม่สำเร็จ');
    } finally { setRuntimeLoading(false); }
  };

  const buildAndRun = async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      if (!platformId) throw new Error('ไม่พบ Platform ID');
      const response = await fetch(`/api/platforms/${platformId}/runtime`, { method: 'POST' });
      const data = await response.json() as { runtime?: PlatformRuntimeStatus; error?: string };
      if (!response.ok || !data.runtime) throw new Error(data.error || 'สร้าง Docker Runtime ไม่สำเร็จ');
      setRuntimeStatus(data.runtime);
      const targetUrl = data.runtime.surfaces?.[activeSurface]?.url || data.runtime.url;
      if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'สร้าง Docker Runtime ไม่สำเร็จ');
    } finally { setRuntimeLoading(false); }
  };

  const viewports = [
    { id: 'desktop' as const, label: 'จอคอมพิวเตอร์', short: 'คอม', icon: Monitor },
    { id: 'tablet' as const, label: 'แท็บเล็ต', short: 'แท็บเล็ต', icon: Tablet },
    { id: 'mobile' as const, label: 'มือถือ', short: 'มือถือ', icon: Smartphone },
  ];

  return (
    <div
      className={`${compactTop ? 'bg-transparent border-0 p-0 shadow-none' : 'bg-white border-bottom p-2 px-3'} d-flex align-items-center justify-content-between gap-2 text-nowrap w-100`}
    >
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <div className="d-flex align-items-center gap-1">
          <Box size={14} style={{ color: 'var(--gov-muted)' }} aria-hidden="true" />
          <label htmlFor="stu-surface" className="visually-hidden">ส่วนที่กำลังออกแบบ</label>
          <select
            id="stu-surface"
            className="adm-select"
            style={{ width: '8.5rem', minHeight: '2.15rem', fontSize: '0.8rem' }}
            value={activeSurface}
            onChange={(event) => setActiveSurface(event.target.value as 'frontend' | 'backend')}
          >
            <option value="frontend">หน้าเว็บสาธารณะ</option>
            <option value="backend">หน้าจัดการ</option>
          </select>
        </div>

        <div className="d-flex align-items-center gap-1">
          <button type="button" className="adm-btn is-sm" onClick={onSave} title="บันทึกหน้าเว็บ (Ctrl+S)">
            <Save size={14} aria-hidden="true" /> บันทึก
          </button>
          <button
            type="button"
            className="adm-btn is-quiet is-sm"
            onClick={onDownloadJson}
            title="ส่งออกโครงสร้างหน้าเป็นไฟล์ JSON"
            aria-label="ส่งออกโครงสร้างหน้าเป็นไฟล์ JSON"
          >
            <Download size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="d-flex align-items-center gap-1">
          <button
            type="button" className="adm-btn is-quiet is-sm" onClick={onUndo} disabled={!canUndo}
            title="ย้อนกลับ (Ctrl+Z)" aria-label="ย้อนกลับ"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button
            type="button" className="adm-btn is-quiet is-sm" onClick={onRedo} disabled={!canRedo}
            title="ทำซ้ำ (Ctrl+Y)" aria-label="ทำซ้ำ"
          >
            <RotateCw size={14} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className={`adm-btn is-sm ${isPreviewMode ? '' : 'is-quiet'}`}
          onClick={inspectRuntime}
          title="สร้างและเปิดเว็บไซต์จริงเพื่อทดสอบ"
        >
          <Play size={14} aria-hidden="true" /> ทดลองรันจริง
        </button>

        {!compactTop && (
          <>
            <div className="d-flex align-items-center gap-1" role="group" aria-label="ขนาดหน้าจอที่แสดง">
              {viewports.map((viewport) => (
                <button
                  key={viewport.id}
                  type="button"
                  className={`adm-btn is-sm ${viewportMode === viewport.id ? '' : 'is-quiet'}`}
                  onClick={() => setViewportMode(viewport.id)}
                  title={viewport.label}
                  aria-pressed={viewportMode === viewport.id}
                >
                  <viewport.icon size={14} aria-hidden="true" />
                  <span className="d-none d-xl-inline">{viewport.short}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`adm-btn is-sm ${showGrid ? '' : 'is-quiet'}`}
              onClick={() => setShowGrid(!showGrid)}
              aria-pressed={showGrid}
              title="แสดงเส้นตารางช่วยจัดวาง"
            >
              <Grid size={14} aria-hidden="true" />
              <span className="d-none d-xl-inline">เส้นตาราง</span>
            </button>

            <div className="d-flex align-items-center gap-1">
              <label htmlFor="stu-zoom" className="visually-hidden">ระดับการย่อขยาย</label>
              <select
                id="stu-zoom"
                className="adm-select font-monospace"
                style={{ width: '5.5rem', minHeight: '2.15rem', fontSize: '0.8rem' }}
                value={zoomLevel}
                onChange={(event) => setZoomLevel(Number(event.target.value))}
              >
                {zoomLevels.map((level) => (
                  <option key={level} value={level}>{level}%</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {!compactTop && (
        <div className="d-none d-xl-flex align-items-center gap-2">
          <button type="button" className="adm-btn is-quiet is-sm" onClick={onOpenPageManager}>
            <FileText size={14} aria-hidden="true" />
            หน้า: <code>{activePageSlug}</code>
          </button>
          <span className="adm-chip is-info">{appInfo.appName}</span>
        </div>
      )}

      <AdminModal
        isOpen={runtimeModalOpen}
        wide
        title="ทดลองรันเว็บไซต์จริง"
        subtitle={appInfo.appName}
        onClose={() => setRuntimeModalOpen(false)}
        footer={
          <>
            <button type="button" className="adm-btn is-quiet" onClick={() => setRuntimeModalOpen(false)}>
              ปิด
            </button>
            <button
              type="button"
              className="adm-btn"
              disabled={runtimeLoading || !runtimeStatus?.dockerConnected}
              onClick={buildAndRun}
            >
              <Play size={15} aria-hidden="true" />
              {runtimeStatus?.exists ? 'สร้างใหม่แล้วเปิด' : 'สร้างและเปิด'}
            </button>
          </>
        }
      >
        {runtimeLoading && (
          <div className="adm-empty">
            <RefreshCw size={26} className="adm-spin mb-2" aria-hidden="true" />
            <p className="adm-empty-title">กำลังตรวจสอบและจัดเตรียม…</p>
            <p className="adm-empty-text">ขั้นตอนนี้อาจใช้เวลาสักครู่</p>
          </div>
        )}

        {!runtimeLoading && runtimeError && (
          <div className="adm-alert is-danger" role="alert">
            <AlertTriangle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
            <span>{runtimeError}</span>
          </div>
        )}

        {!runtimeLoading && runtimeStatus && (
          <>
            <div
              className={`adm-alert mb-3 ${
                !runtimeStatus.dockerConnected ? 'is-danger'
                  : runtimeStatus.stale ? 'is-warn'
                  : runtimeStatus.exists ? 'is-info' : 'is-info'
              }`}
            >
              {runtimeStatus.exists && !runtimeStatus.stale
                ? <CheckCircle2 size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
                : <AlertTriangle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />}
              <span>
                <strong>
                  {!runtimeStatus.dockerConnected ? 'ระบบเบื้องหลังยังไม่พร้อม'
                    : runtimeStatus.stale ? 'มีการแก้ไขหลังสร้างครั้งล่าสุด'
                    : runtimeStatus.exists ? 'พร้อมเปิดทดสอบ'
                    : 'ยังไม่เคยสร้าง'}
                </strong>
                <span className="d-block">
                  {runtimeStatus.stale ? 'ต้องสร้างใหม่ก่อนจึงจะเห็นการเปลี่ยนแปลงล่าสุด'
                    : runtimeStatus.exists ? 'สิ่งที่สร้างไว้ตรงกับหน้าเว็บและข้อมูลปัจจุบันแล้ว'
                    : 'กดปุ่ม “สร้างและเปิด” เพื่อเริ่มครั้งแรก'}
                </span>
              </span>
            </div>

            <dl className="adm-facts">
              <div><dt>ที่อยู่ไฟล์</dt><dd className="font-monospace text-break">{runtimeStatus.runtimePath}</dd></div>
              <div><dt>อิมเมจ</dt><dd className="font-monospace text-break">{runtimeStatus.image || 'ยังไม่ได้สร้าง'}</dd></div>
              <div><dt>คอนเทนเนอร์</dt><dd className="font-monospace text-break">{runtimeStatus.containerName || 'ยังไม่ได้สร้าง'}</dd></div>
              <div><dt>รุ่นที่สร้างไว้</dt><dd className="font-monospace">{runtimeStatus.buildRevision || '—'}</dd></div>
              <div><dt>พอร์ตที่เปิด</dt><dd className="font-monospace">{runtimeStatus.port || '—'}</dd></div>
              {Object.entries(runtimeStatus.surfaces || {}).map(([surface, info]) => (
                <div key={surface}>
                  <dt>{surface === 'frontend' ? 'หน้าเว็บสาธารณะ' : 'หน้าจัดการ'}</dt>
                  <dd className="font-monospace">:{info.port || '—'}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </AdminModal>
    </div>
  );
};
