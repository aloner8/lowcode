'use client';

import React, { useState } from 'react';
import { Box, Plus, Server, Database, ExternalLink, Palette, Play, Layers, Sliders } from 'lucide-react';
import Link from 'next/link';
import { AppConfig } from '@/types';

export default function TenantAppsPage() {
  const [apps, setApps] = useState<AppConfig[]>([
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      platformId: 'p0000000-0000-0000-0000-000000000001',
      appSlug: 'demo-client-a',
      appName: 'Demo Client App A',
      description: 'Sample Child App A derived from PlatformERP',
      port: 3001,
      subdomain: 'client-a.localhost',
      tenantDbName: 'app_db_client_a',
      themeConfig: {
        preset: 'corporate-emerald',
        mode: 'light',
        primaryColor: '#198754',
        borderRadius: '0.5rem',
        fontFamily: 'Inter, sans-serif',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appSlug, setAppSlug] = useState('');
  const [port, setPort] = useState(3002);
  const [subdomain, setSubdomain] = useState('');
  const [platformId, setPlatformId] = useState('p0000000-0000-0000-0000-000000000001');

  const handleProvision = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: AppConfig = {
      id: `app-${Date.now()}`,
      platformId: platformId,
      appSlug: appSlug || `client-${Date.now()}`,
      appName: appName || 'New Client App',
      port: Number(port),
      subdomain: subdomain || `${appSlug}.localhost`,
      tenantDbName: `app_db_${appSlug.replace(/-/g, '_')}`,
      themeConfig: {
        preset: 'modern-indigo',
        mode: 'light',
        primaryColor: '#0d6efd',
        borderRadius: '0.375rem',
        fontFamily: 'Inter, sans-serif',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setApps([...apps, newApp]);
    setIsProvisionOpen(false);
    setAppName('');
    setAppSlug('');
  };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-0.5 text-dark d-flex align-items-center gap-2 text-nowrap">
            <Box className="text-primary" size={20} />
            Tenant Child Apps (Multi-App Control)
          </h4>
          <p className="text-secondary small mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
            Manage Docker containers, host ports, subdomains, and isolated tenant databases
          </p>
        </div>

        <button
          onClick={() => setIsProvisionOpen(true)}
          className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-medium text-nowrap"
          style={{ fontSize: '0.8rem' }}
        >
          <Plus size={16} />
          <span>+ Provision New Tenant App</span>
        </button>
      </div>

      <div className="row g-3">
        {apps.map((app) => (
          <div key={app.id} className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
              <div className="card-body p-3.5">
                <div className="d-flex align-items-start justify-content-between mb-2.5">
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-white shadow-sm"
                      style={{
                        width: '42px',
                        height: '42px',
                        background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                      }}
                    >
                      <Box size={20} />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0 text-dark small text-nowrap">{app.appName}</h5>
                      <div className="d-flex align-items-center gap-1 mt-0.5">
                        <span className="badge bg-light text-secondary border extra-small text-nowrap">{app.appSlug}</span>
                        <span className="badge bg-indigo bg-opacity-10 text-primary border border-primary border-opacity-25 extra-small text-nowrap d-inline-flex align-items-center gap-1" style={{ fontSize: '0.62rem' }}>
                          <Layers size={10} /> PlatformERP Inherited
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 px-2 py-0.5 extra-small text-nowrap">
                    🟢 Container Running
                  </span>
                </div>

                <div className="row g-2 mb-3 p-2.5 bg-light rounded-3">
                  <div className="col-6">
                    <div className="text-muted extra-small d-flex align-items-center gap-1 text-nowrap" style={{ fontSize: '0.72rem' }}>
                      <Server size={12} /> Host Port & Domain:
                    </div>
                    <div className="fw-semibold extra-small text-dark mt-0.5 text-nowrap">
                      Port :{app.port} | <code>{app.subdomain}</code>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="text-muted extra-small d-flex align-items-center gap-1 text-nowrap" style={{ fontSize: '0.72rem' }}>
                      <Database size={12} /> Tenant DB Name:
                    </div>
                    <div className="fw-semibold extra-small text-dark mt-0.5 text-nowrap">
                      <code>{app.tenantDbName}</code>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Link
                    href={`/studio?appId=${app.id}`}
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center py-1.5 text-nowrap"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <Palette size={14} />
                    <span>DesignStudio</span>
                  </Link>
                  <Link
                    href={`/app/${app.appSlug}`}
                    target="_blank"
                    className="btn btn-sm btn-success text-white d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center py-1.5 text-nowrap"
                    style={{ fontSize: '0.78rem' }}
                  >
                    <Play size={14} />
                    <span>Run Dynamic Player</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Provision Modal */}
      {isProvisionOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold fs-6">Provision New Tenant App</h5>
                <button type="button" className="btn-close" onClick={() => setIsProvisionOpen(false)}></button>
              </div>
              <form onSubmit={handleProvision}>
                <div className="modal-body px-4 py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">Parent Platform Blueprint</label>
                    <select
                      className="form-select"
                      value={platformId}
                      onChange={(e) => setPlatformId(e.target.value)}
                    >
                      <option value="p0000000-0000-0000-0000-000000000001">🏢 PlatformERP Enterprise Solution (Master ERP)</option>
                      <option value="p0000000-0000-0000-0000-000000000002">🏢 PlatformCRM Sales & Lead Solution (Master CRM)</option>
                    </select>
                    <div className="form-text extra-small text-muted">Tenant App will inherit layouts and flows from this Platform Blueprint.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">App Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Client App B"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">App Slug (Identifier)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. client-b"
                      value={appSlug}
                      onChange={(e) => setAppSlug(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium text-secondary">Host Docker Port</label>
                    <input
                      type="number"
                      className="form-control"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setIsProvisionOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Confirm Provision
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
