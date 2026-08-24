'use client';

import React, { useState } from 'react';
import { AppConfig, AppWorkFlowManifest, AppBootService, AppMenuItem, MenuActionType } from '@/types';
import {
  Workflow,
  Server,
  Compass,
  Play,
  Plus,
  Trash2,
  Save,
  Check,
  ExternalLink,
  Code2,
  Database,
  ShieldCheck,
  Palette,
  FileText,
  Zap,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface AppWorkflowDesignerProps {
  appInfo: AppConfig;
  onSaveManifest: (manifest: AppWorkFlowManifest) => void;
}

export const AppWorkflowDesigner: React.FC<AppWorkflowDesignerProps> = ({ appInfo, onSaveManifest }) => {
  const [activeTab, setActiveTab] = useState<'boot' | 'navigation' | 'json'>('navigation');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Initial App WorkFlow Manifest State
  const [manifest, setManifest] = useState<AppWorkFlowManifest>({
    appId: appInfo.id,
    appSlug: appInfo.appSlug,
    appName: appInfo.appName,
    version: '1.2.0',
    defaultPageSlug: 'index',
    updatedAt: new Date().toISOString(),
    bootServices: [
      {
        id: 'boot_01',
        serviceName: 'Tenant Auth Session Validation',
        type: 'AUTH_CHECK',
        required: true,
      },
      {
        id: 'boot_02',
        serviceName: 'Dynamic CSS Theme Injection',
        type: 'THEME_INJECT',
        required: true,
        config: { preset: appInfo.themeConfig.preset },
      },
      {
        id: 'boot_03',
        serviceName: 'Tenant DB Connection Pool',
        type: 'DB_CONNECT',
        required: true,
        config: { dbName: appInfo.tenantDbName, port: appInfo.port },
      },
    ],
    masterNavigation: [
      {
        id: 'menu_01',
        label: 'Home Dashboard',
        icon: 'Home',
        badge: 'Main',
        roles: ['admin', 'member'],
        action: {
          type: 'OPEN_PAGE',
          targetPageSlug: 'index',
        },
      },
      {
        id: 'menu_02',
        label: 'Client Services',
        icon: 'Box',
        roles: ['admin', 'member'],
        action: {
          type: 'OPEN_PAGE',
          targetPageSlug: 'services',
        },
      },
      {
        id: 'menu_03',
        label: 'Sync Customer Data',
        icon: 'RefreshCw',
        roles: ['admin'],
        action: {
          type: 'RUN_SERVICE',
          serviceEndpoint: '/api/v1/tenant/sync-data',
          httpMethod: 'POST',
        },
      },
      {
        id: 'menu_04',
        label: 'Onboarding Wizard Flow',
        icon: 'Workflow',
        roles: ['admin'],
        action: {
          type: 'TRIGGER_WORKFLOW',
          workflowTreeId: 'wf_client_onboarding',
        },
      },
    ],
  });

  const [selectedMenuId, setSelectedMenuId] = useState<string>('menu_01');
  const selectedMenuItem = manifest.masterNavigation.find((m) => m.id === selectedMenuId) || manifest.masterNavigation[0];

  // Add Boot Service
  const handleAddBootService = () => {
    const newService: AppBootService = {
      id: `boot_${Date.now()}`,
      serviceName: 'New Startup API Service',
      type: 'API_INIT',
      required: false,
    };
    setManifest((prev) => ({
      ...prev,
      bootServices: [...prev.bootServices, newService],
    }));
  };

  // Add Menu Item
  const handleAddMenuItem = () => {
    const newItem: AppMenuItem = {
      id: `menu_${Date.now()}`,
      label: 'New Menu Item',
      icon: 'FileText',
      roles: ['admin'],
      action: {
        type: 'OPEN_PAGE',
        targetPageSlug: 'index',
      },
    };
    setManifest((prev) => ({
      ...prev,
      masterNavigation: [...prev.masterNavigation, newItem],
    }));
    setSelectedMenuId(newItem.id);
  };

  // Update Menu Item
  const handleUpdateMenuItem = (id: string, updated: Partial<AppMenuItem>) => {
    setManifest((prev) => ({
      ...prev,
      masterNavigation: prev.masterNavigation.map((item) =>
        item.id === id ? { ...item, ...updated } : item
      ),
    }));
  };

  // Delete Menu Item
  const handleDeleteMenuItem = (id: string) => {
    setManifest((prev) => ({
      ...prev,
      masterNavigation: prev.masterNavigation.filter((item) => item.id !== id),
    }));
    if (selectedMenuId === id) {
      setSelectedMenuId(manifest.masterNavigation[0]?.id || '');
    }
  };

  // Save Manifest
  const handleSave = () => {
    onSaveManifest(manifest);
    setSaveStatus('Master App WorkFlow Saved!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="card shadow-sm border-0 rounded-3 bg-white overflow-hidden h-100 select-none">
      {/* Header Banner */}
      <div
        className="card-header border-0 text-white p-3.5"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #31104b 100%)',
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 bg-white bg-opacity-15 d-flex align-items-center justify-content-center text-white flex-shrink-0"
              style={{ width: '42px', height: '42px' }}
            >
              <Workflow size={24} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-white bg-opacity-20 text-white extra-small">
                  Master App WorkFlow Engine
                </span>
                <span className="badge bg-info bg-opacity-25 text-info-light border border-info border-opacity-30 extra-small">
                  v{manifest.version}
                </span>
              </div>
              <h5 className="fw-bold mb-0 text-white">
                {appInfo.appName} <span className="text-white-50 fs-6 fw-normal">({appInfo.appSlug})</span>
              </h5>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {saveStatus && <span className="badge bg-success text-white px-2.5 py-1.5 extra-small">{saveStatus}</span>}
            <button
              className="btn btn-sm btn-primary px-3 fw-semibold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handleSave}
            >
              <Save size={15} /> Save Master Manifest
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-light border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
        <div className="btn-group btn-group-sm bg-white p-0.5 rounded-2 border">
          <button
            className={`btn btn-sm py-1 px-3 extra-small fw-semibold ${
              activeTab === 'navigation' ? 'bg-primary text-white shadow-sm' : 'text-secondary'
            }`}
            onClick={() => setActiveTab('navigation')}
          >
            <Compass size={13} className="me-1" /> Master Navigation & Actions
          </button>
          <button
            className={`btn btn-sm py-1 px-3 extra-small fw-semibold ${
              activeTab === 'boot' ? 'bg-primary text-white shadow-sm' : 'text-secondary'
            }`}
            onClick={() => setActiveTab('boot')}
          >
            <Server size={13} className="me-1" /> Bootstrapping Services ({manifest.bootServices.length})
          </button>
          <button
            className={`btn btn-sm py-1 px-3 extra-small fw-semibold ${
              activeTab === 'json' ? 'bg-primary text-white shadow-sm' : 'text-secondary'
            }`}
            onClick={() => setActiveTab('json')}
          >
            <Code2 size={13} className="me-1" /> Manifest JSON AST
          </button>
        </div>

        <small className="text-muted extra-small">
          App WorkFlow controls app entry, startup services, and menu routing.
        </small>
      </div>

      {/* Tab Content Body */}
      <div className="card-body p-3 overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {/* ======================================================== */}
        {/* 1. Master Navigation & Action Router Tab */}
        {/* ======================================================== */}
        {activeTab === 'navigation' && (
          <div className="row g-3 h-100">
            {/* Left: Menu Items Tree */}
            <div className="col-12 col-md-5">
              <div className="card border shadow-none rounded-3 bg-light p-3 h-100">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-dark small mb-0 d-flex align-items-center gap-1.5">
                    <Compass size={16} className="text-primary" /> Master Navigation Tree
                  </h6>
                  <button
                    className="btn btn-sm btn-outline-primary py-0.5 px-2 extra-small d-flex align-items-center gap-1"
                    onClick={handleAddMenuItem}
                  >
                    <Plus size={13} /> Add Menu
                  </button>
                </div>

                <div className="d-flex flex-column gap-2">
                  {manifest.masterNavigation.map((item) => {
                    const isSelected = item.id === selectedMenuId;
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-2 border cursor-pointer transition ${
                          isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-dark hover-border-primary'
                        }`}
                        onClick={() => setSelectedMenuId(item.id)}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="fw-semibold small d-flex align-items-center gap-2">
                            <span>{item.label}</span>
                          </span>
                          <span
                            className={`badge extra-small ${
                              item.action.type === 'OPEN_PAGE'
                                ? 'bg-info bg-opacity-20 text-info'
                                : item.action.type === 'RUN_SERVICE'
                                ? 'bg-warning bg-opacity-20 text-warning'
                                : 'bg-success bg-opacity-20 text-success'
                            }`}
                            style={{ fontSize: '0.62rem' }}
                          >
                            {item.action.type}
                          </span>
                        </div>

                        <div className="extra-small text-opacity-75 text-truncate" style={{ fontSize: '0.7rem' }}>
                          {item.action.type === 'OPEN_PAGE' && `Target Page: /${item.action.targetPageSlug}`}
                          {item.action.type === 'RUN_SERVICE' && `API: ${item.action.serviceEndpoint}`}
                          {item.action.type === 'TRIGGER_WORKFLOW' && `Flow ID: ${item.action.workflowTreeId}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Selected Menu Item Action Dispatcher Configurator */}
            <div className="col-12 col-md-7">
              {selectedMenuItem ? (
                <div className="card border shadow-none rounded-3 bg-white p-3.5 h-100">
                  <div className="d-flex align-items-center justify-content-between border-bottom pb-2.5 mb-3">
                    <div>
                      <span className="badge bg-primary bg-opacity-10 text-primary extra-small mb-1">
                        Menu Configurator
                      </span>
                      <h6 className="fw-bold text-dark mb-0">{selectedMenuItem.label}</h6>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-danger extra-small d-flex align-items-center gap-1"
                      onClick={() => handleDeleteMenuItem(selectedMenuItem.id)}
                    >
                      <Trash2 size={13} /> Delete Menu
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-3">
                    {/* Label & Icon */}
                    <div className="row g-2">
                      <div className="col-8">
                        <label className="form-label extra-small fw-bold text-secondary mb-1">Menu Label</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-light border-0"
                          value={selectedMenuItem.label}
                          onChange={(e) => handleUpdateMenuItem(selectedMenuItem.id, { label: e.target.value })}
                        />
                      </div>
                      <div className="col-4">
                        <label className="form-label extra-small fw-bold text-secondary mb-1">Badge</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-light border-0"
                          value={selectedMenuItem.badge || ''}
                          placeholder="e.g. New"
                          onChange={(e) => handleUpdateMenuItem(selectedMenuItem.id, { badge: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Action Type Selector */}
                    <div className="p-3 bg-light rounded-3 border">
                      <label className="form-label extra-small fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
                        <Zap size={14} className="text-warning" /> Menu Click Action Handler
                      </label>

                      <div className="btn-group w-100 mb-3">
                        <button
                          className={`btn btn-sm extra-small fw-semibold ${
                            selectedMenuItem.action.type === 'OPEN_PAGE' ? 'btn-primary shadow-sm' : 'btn-outline-secondary bg-white'
                          }`}
                          onClick={() =>
                            handleUpdateMenuItem(selectedMenuItem.id, {
                              action: { ...selectedMenuItem.action, type: 'OPEN_PAGE', targetPageSlug: 'index' },
                            })
                          }
                        >
                          📄 OPEN_PAGE
                        </button>
                        <button
                          className={`btn btn-sm extra-small fw-semibold ${
                            selectedMenuItem.action.type === 'RUN_SERVICE' ? 'btn-warning text-dark shadow-sm' : 'btn-outline-secondary bg-white'
                          }`}
                          onClick={() =>
                            handleUpdateMenuItem(selectedMenuItem.id, {
                              action: { ...selectedMenuItem.action, type: 'RUN_SERVICE', serviceEndpoint: '/api/v1/tenant/sync', httpMethod: 'POST' },
                            })
                          }
                        >
                          🔌 RUN_SERVICE
                        </button>
                        <button
                          className={`btn btn-sm extra-small fw-semibold ${
                            selectedMenuItem.action.type === 'TRIGGER_WORKFLOW' ? 'btn-success shadow-sm' : 'btn-outline-secondary bg-white'
                          }`}
                          onClick={() =>
                            handleUpdateMenuItem(selectedMenuItem.id, {
                              action: { ...selectedMenuItem.action, type: 'TRIGGER_WORKFLOW', workflowTreeId: 'wf_main' },
                            })
                          }
                        >
                          ⚡ TRIGGER_WORKFLOW
                        </button>
                      </div>

                      {/* Config parameters per Action Type */}
                      {selectedMenuItem.action.type === 'OPEN_PAGE' && (
                        <div>
                          <label className="form-label extra-small fw-semibold text-secondary mb-1">Target Page Slug</label>
                          <select
                            className="form-select form-select-sm bg-white"
                            value={selectedMenuItem.action.targetPageSlug || 'index'}
                            onChange={(e) =>
                              handleUpdateMenuItem(selectedMenuItem.id, {
                                action: { ...selectedMenuItem.action, targetPageSlug: e.target.value },
                              })
                            }
                          >
                            <option value="index">index (Home Dashboard Layout)</option>
                            <option value="about">about (About Us Layout)</option>
                            <option value="services">services (Services Layout)</option>
                          </select>
                        </div>
                      )}

                      {selectedMenuItem.action.type === 'RUN_SERVICE' && (
                        <div>
                          <label className="form-label extra-small fw-semibold text-secondary mb-1">Tenant Service Endpoint</label>
                          <input
                            type="text"
                            className="form-control form-control-sm bg-white font-monospace mb-2"
                            value={selectedMenuItem.action.serviceEndpoint || ''}
                            onChange={(e) =>
                              handleUpdateMenuItem(selectedMenuItem.id, {
                                action: { ...selectedMenuItem.action, serviceEndpoint: e.target.value },
                              })
                            }
                          />
                        </div>
                      )}

                      {selectedMenuItem.action.type === 'TRIGGER_WORKFLOW' && (
                        <div>
                          <label className="form-label extra-small fw-semibold text-secondary mb-1">Target Workflow Tree ID</label>
                          <input
                            type="text"
                            className="form-control form-control-sm bg-white font-monospace"
                            value={selectedMenuItem.action.workflowTreeId || ''}
                            onChange={(e) =>
                              handleUpdateMenuItem(selectedMenuItem.id, {
                                action: { ...selectedMenuItem.action, workflowTreeId: e.target.value },
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card border p-4 text-center text-muted">Select a menu to configure actions.</div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. Bootstrapping Services Tab */}
        {/* ======================================================== */}
        {activeTab === 'boot' && (
          <div className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="fw-bold text-dark mb-1">App Startup Bootstrapping Services</h6>
                <p className="text-muted extra-small mb-0">
                  Services executed automatically when an End-User launches child app <code>{appInfo.appSlug}</code>.
                </p>
              </div>
              <button className="btn btn-sm btn-primary px-3 extra-small d-flex align-items-center gap-1" onClick={handleAddBootService}>
                <Plus size={13} /> Add Boot Service
              </button>
            </div>

            <div className="d-flex flex-column gap-2">
              {manifest.bootServices.map((service, idx) => (
                <div key={service.id} className="card border p-3 rounded-3 bg-light d-flex flex-row align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="badge bg-dark text-white p-2 rounded-circle font-monospace">#{idx + 1}</div>
                    <div>
                      <div className="fw-bold text-dark small d-flex align-items-center gap-2">
                        {service.serviceName}
                        <span className="badge bg-primary bg-opacity-10 text-primary extra-small">{service.type}</span>
                      </div>
                      <div className="extra-small text-muted font-monospace mt-0.5">ID: {service.id}</div>
                    </div>
                  </div>
                  <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 px-2.5 py-1 extra-small">
                    Required Boot Service
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. Manifest JSON AST Tab */}
        {/* ======================================================== */}
        {activeTab === 'json' && (
          <div>
            <textarea
              className="form-control font-monospace extra-small bg-dark text-light p-3 rounded-3"
              rows={16}
              value={JSON.stringify(manifest, null, 2)}
              readOnly
              style={{ fontSize: '0.8rem', lineHeight: '1.45' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
