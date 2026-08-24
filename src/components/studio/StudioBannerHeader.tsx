'use client';

import React from 'react';
import { AppConfig } from '@/types';
import { Palette, Eye, Download, Save, Box, Database, Server, RefreshCw } from 'lucide-react';

interface StudioBannerHeaderProps {
  appInfo: AppConfig;
  isPreviewMode: boolean;
  setIsPreviewMode: (val: boolean) => void;
  saveStatus: string | null;
  onSave: () => void;
  onDownloadJson: () => void;
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  setViewportMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

export const StudioBannerHeader: React.FC<StudioBannerHeaderProps> = ({
  appInfo,
  isPreviewMode,
  setIsPreviewMode,
  saveStatus,
  onSave,
  onDownloadJson,
  viewportMode,
  setViewportMode,
}) => {
  return (
    <div
      className="card border-0 text-white rounded-3 shadow-sm mb-3 p-3.5"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #31104b 50%, #4c1d95 100%)',
      }}
    >
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        {/* Title & App Info Badges */}
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-3 bg-white bg-opacity-15 text-white flex-shrink-0"
            style={{ width: '42px', height: '42px' }}
          >
            <Palette size={24} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-white bg-opacity-20 text-white px-2 py-0.5 rounded-pill extra-small text-nowrap">
                DesignMode Studio Engine
              </span>
              <span className="badge bg-success bg-opacity-25 text-success-light border border-success border-opacity-30 px-2 py-0.5 extra-small">
                🟢 Live Ready
              </span>
            </div>
            <h5 className="fw-bold mb-0 text-white text-nowrap d-flex align-items-center gap-2">
              {appInfo.appName}
              <span className="text-white-50 fs-6 fw-normal font-monospace">({appInfo.appSlug})</span>
            </h5>
            <div className="text-white-50 extra-small d-flex align-items-center gap-3 mt-1 flex-wrap" style={{ fontSize: '0.73rem' }}>
              <span className="d-flex align-items-center gap-1">
                <Server size={12} className="text-info" /> Port: <code>:{appInfo.port}</code>
              </span>
              <span>•</span>
              <span className="d-flex align-items-center gap-1">
                <Database size={12} className="text-warning" /> DB: <code>{appInfo.tenantDbName}</code>
              </span>
              <span>•</span>
              <span className="d-flex align-items-center gap-1">
                <Box size={12} className="text-secondary" /> Theme: <strong>{appInfo.themeConfig.preset}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Save Status */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {saveStatus && (
            <span className="badge bg-success bg-opacity-20 text-white border border-success border-opacity-40 px-2.5 py-1.5 rounded-2 extra-small">
              {saveStatus}
            </span>
          )}

          {/* Device Frame Viewport Selectors */}
          <div className="btn-group btn-group-sm bg-white bg-opacity-10 p-0.5 rounded-2 border border-white border-opacity-10 me-1">
            <button
              className={`btn btn-sm text-white px-2 py-1 ${viewportMode === 'desktop' ? 'bg-white bg-opacity-25 fw-bold' : ''}`}
              onClick={() => setViewportMode('desktop')}
              title="Desktop View (100%)"
              style={{ fontSize: '0.75rem' }}
            >
              💻 Desktop
            </button>
            <button
              className={`btn btn-sm text-white px-2 py-1 ${viewportMode === 'tablet' ? 'bg-white bg-opacity-25 fw-bold' : ''}`}
              onClick={() => setViewportMode('tablet')}
              title="Tablet View (768px)"
              style={{ fontSize: '0.75rem' }}
            >
              📱 Tablet
            </button>
            <button
              className={`btn btn-sm text-white px-2 py-1 ${viewportMode === 'mobile' ? 'bg-white bg-opacity-25 fw-bold' : ''}`}
              onClick={() => setViewportMode('mobile')}
              title="Mobile View (375px)"
              style={{ fontSize: '0.75rem' }}
            >
              📲 Mobile
            </button>
          </div>

          <button
            className={`btn btn-sm fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap ${
              isPreviewMode ? 'btn-success shadow-sm' : 'btn-outline-light'
            }`}
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            style={{ fontSize: '0.8rem' }}
          >
            <Eye size={15} />
            <span>{isPreviewMode ? 'Exit Preview' : 'Live Preview'}</span>
          </button>

          <button
            className="btn btn-outline-light btn-sm fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap"
            onClick={onDownloadJson}
            style={{ fontSize: '0.8rem' }}
          >
            <Download size={15} />
            <span>Export JSON</span>
          </button>

          <button
            className="btn btn-primary btn-sm fw-semibold d-flex align-items-center gap-1.5 px-3.5 py-1.5 rounded-2 shadow-sm text-nowrap"
            onClick={onSave}
            style={{
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              border: 'none',
            }}
          >
            <Save size={15} />
            <span>Save Layout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
