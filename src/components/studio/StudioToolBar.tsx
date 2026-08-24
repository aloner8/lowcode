'use client';

import React, { useState } from 'react';
import { Save, Play, RotateCcw, RotateCw, Download, Monitor, Tablet, Smartphone, Grid, FileText, Box, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';
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
  setIsPreviewMode,
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

  return (
    <div
      className={`${compactTop ? 'bg-transparent border-0 p-0 shadow-none' : 'bg-white border-bottom p-1.5 px-3 shadow-sm'} d-flex align-items-center justify-content-between text-nowrap select-none w-100`}
      style={{ fontSize: '0.78rem' }}
    >
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <div className="d-flex align-items-center gap-1 border rounded-2 px-2 py-1 bg-light">
          <Box size={13} className={activeSurface === 'backend' ? 'text-warning' : 'text-primary'} />
          <span className="text-muted extra-small">App</span>
          <select className="form-select form-select-sm border-0 bg-transparent py-0 ps-1 pe-4 fw-bold" style={{ width: 112, fontSize: '0.72rem' }} value={activeSurface} onChange={(event) => setActiveSurface(event.target.value as 'frontend' | 'backend')}>
            <option value="frontend">Frontend</option><option value="backend">Backend</option>
          </select>
        </div>
        <span className="text-secondary opacity-25">|</span>
        {/* Save & Download */}
        <div className="btn-group btn-group-sm">
          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-1 px-2.5 py-1 extra-small fw-semibold shadow-sm"
            onClick={onSave}
            title="Save Page Layout (Ctrl+S)"
          >
            <Save size={13} />
            <span>Save</span>
          </button>
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-2 py-1 extra-small"
            onClick={onDownloadJson}
            title="Export JSON AST"
          >
            <Download size={13} />
          </button>
        </div>

        <span className="text-secondary opacity-25">|</span>

        {/* Undo / Redo */}
        <div className="btn-group btn-group-sm">
          <button
            className={`btn btn-sm p-1 ${canUndo ? 'btn-light text-primary fw-bold' : 'btn-light text-muted opacity-40'}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            className={`btn btn-sm p-1 ${canRedo ? 'btn-light text-primary fw-bold' : 'btn-light text-muted opacity-40'}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw size={13} />
          </button>
        </div>

        <span className="text-secondary opacity-25">|</span>

        {/* Live Run Preview Button */}
        <button
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3 py-1 extra-small fw-bold text-nowrap rounded-2 ${
            isPreviewMode
              ? 'btn-success text-white shadow-sm'
              : 'btn-outline-success border-success text-success'
          }`}
          onClick={inspectRuntime}
        >
          <Play size={13} className="fill-current" />
          <span>Live Run App</span>
        </button>

        {!compactTop && <>
        <span className="text-secondary opacity-25">|</span>

        {/* Device Viewport Selector */}
        <div className="btn-group btn-group-sm bg-light p-0.5 rounded-2 border">
          <button
            className={`btn btn-sm py-0.5 px-2 text-dark extra-small border-0 ${viewportMode === 'desktop' ? 'bg-white shadow-sm fw-bold' : 'text-secondary'}`}
            onClick={() => setViewportMode('desktop')}
            title="Desktop Viewport (100%)"
          >
            <Monitor size={13} className="me-1" /> Desktop
          </button>
          <button
            className={`btn btn-sm py-0.5 px-2 text-dark extra-small border-0 ${viewportMode === 'tablet' ? 'bg-white shadow-sm fw-bold' : 'text-secondary'}`}
            onClick={() => setViewportMode('tablet')}
            title="Tablet Viewport (768px)"
          >
            <Tablet size={13} className="me-1" /> Tablet
          </button>
          <button
            className={`btn btn-sm py-0.5 px-2 text-dark extra-small border-0 ${viewportMode === 'mobile' ? 'bg-white shadow-sm fw-bold' : 'text-secondary'}`}
            onClick={() => setViewportMode('mobile')}
            title="Mobile Viewport (375px)"
          >
            <Smartphone size={13} className="me-1" /> Mobile
          </button>
        </div>

        <span className="text-secondary opacity-25">|</span>

        {/* Visual Grid Toggle */}
        <button
          className={`btn btn-sm py-1 px-2 extra-small border-0 rounded-2 ${
            showGrid ? 'btn-primary bg-primary bg-opacity-10 text-primary fw-semibold' : 'btn-light text-secondary'
          }`}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Visual Dotted Designer Grid"
        >
          <Grid size={13} className="me-1" /> Grid Guide
        </button>

        <span className="text-secondary opacity-25">|</span>

        {/* Zoom Controls */}
        <div className="d-flex align-items-center gap-1">
          <select
            className="form-select form-select-sm extra-small bg-light border-0 py-0.5 text-dark font-monospace"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            style={{ width: '75px', fontSize: '0.72rem' }}
          >
            {zoomLevels.map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
        </div>
        </>}
      </div>

      {/* Right side active page / solution context */}
      {!compactTop && <div className="d-none d-lg-flex align-items-center gap-2">
        <button
          className="btn btn-sm btn-outline-primary py-0.5 px-2.5 extra-small fw-semibold d-flex align-items-center gap-1.5"
          onClick={onOpenPageManager}
        >
          <FileText size={13} />
          <span>Page: <code>{activePageSlug}.page</code></span>
        </button>
        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1 extra-small">
          App: {appInfo.appName}
        </span>
      </div>}
      {runtimeModalOpen && <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 2300, background: 'rgba(15,23,42,.65)', backdropFilter: 'blur(4px)' }}>
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(94vw,680px)' }}>
          <div className="card-header bg-dark text-white border-0 p-3 d-flex justify-content-between align-items-start">
            <div><div className="small text-success fw-bold d-flex gap-1 align-items-center"><Box size={14} /> PLATFORM DOCKER RUNTIME</div><h5 className="fw-bold mb-0">Live Run: {appInfo.appName}</h5></div>
            <button className="btn btn-sm btn-outline-light border-0" onClick={() => setRuntimeModalOpen(false)}><X size={18} /></button>
          </div>
          <div className="card-body p-4">
            {runtimeLoading && <div className="text-center py-4"><RefreshCw size={28} className="spin text-primary mb-2" /><div className="fw-semibold">กำลังตรวจสอบและจัดเตรียม Docker...</div></div>}
            {!runtimeLoading && runtimeError && <div className="alert alert-danger d-flex gap-2"><AlertTriangle size={20} className="flex-shrink-0" /><span>{runtimeError}</span></div>}
            {!runtimeLoading && runtimeStatus && <>
              <div className={`alert d-flex gap-2 ${!runtimeStatus.dockerConnected ? 'alert-danger' : runtimeStatus.stale ? 'alert-warning' : runtimeStatus.exists ? 'alert-success' : 'alert-info'}`}>
                {runtimeStatus.exists && !runtimeStatus.stale ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                <div><strong>{!runtimeStatus.dockerConnected ? 'Docker Engine ไม่พร้อม' : runtimeStatus.stale ? 'Source เปลี่ยนหลัง Build ล่าสุด' : runtimeStatus.exists ? 'Docker Runtime พร้อมรัน' : 'ยังไม่มี Docker Runtime'}</strong><div className="small">{runtimeStatus.stale ? 'ต้อง Generate image ใหม่ก่อน Live Run' : runtimeStatus.exists ? 'Image และ snapshot ตรงกับ Page/DB revision ปัจจุบัน' : 'กด Generate & Run เพื่อสร้างครั้งแรก'}</div></div>
              </div>
              <div className="row g-2 small">
                <div className="col-12"><div className="bg-light rounded-3 p-2"><span className="text-muted">Runtime path</span><code className="d-block">{runtimeStatus.runtimePath}</code></div></div>
                <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><span className="text-muted">Docker image</span><code className="d-block text-break">{runtimeStatus.image || 'not generated'}</code></div></div>
                <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><span className="text-muted">Container</span><code className="d-block text-break">{runtimeStatus.containerName || 'not created'}</code></div></div>
                <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><span className="text-muted">Build revision</span><code className="d-block">{runtimeStatus.buildRevision || '-'}</code></div></div>
                <div className="col-md-6"><div className="bg-light rounded-3 p-2 h-100"><span className="text-muted">Published port</span><code className="d-block">{runtimeStatus.port || '-'}</code></div></div>
                {Object.entries(runtimeStatus.surfaces || {}).map(([surface, info]) => <div className="col-md-6" key={surface}><div className={`rounded-3 p-2 h-100 border ${surface === activeSurface ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`}><span className="text-muted text-capitalize">{surface} runtime</span><code className="d-block">:{info.port || '-'} · {info.containerName}</code></div></div>)}
              </div>
            </>}
          </div>
          <div className="card-footer bg-white border-top p-3 d-flex justify-content-between gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setRuntimeModalOpen(false)}>Cancel</button>
            <button className="btn btn-success d-flex align-items-center gap-2" disabled={runtimeLoading || !runtimeStatus?.dockerConnected} onClick={buildAndRun}><Play size={15} />{runtimeStatus?.exists ? 'Generate New Image & Run' : 'Generate Docker & Run'}</button>
          </div>
        </div>
      </div>}
    </div>
  );
};
