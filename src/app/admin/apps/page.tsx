'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Plus, Server, Database, ExternalLink, Globe, Trash2, Sliders, RefreshCw, Layers, Palette } from 'lucide-react';
import SiteThemeModal from '@/components/admin/SiteThemeModal';
import type { PlatformConfig, TenantOverrides, ThemeConfig } from '@/types';

interface SiteApp {
  appId: string;
  appSlug: string;
  appName: string;
  port: number;
  subdomain: string;
  tenantDbName: string;
  isActive: boolean;
  themeConfig: ThemeConfig;
  tenantOverrides: TenantOverrides;
  platformId: string | null;
  platformSlug: string | null;
  domains: string[];
}

export default function TenantAppsPage() {
  const [apps, setApps] = useState<SiteApp[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [isProvisionOpen, setProvisionOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appSlug, setAppSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [port, setPort] = useState('');
  const [platformId, setPlatformId] = useState('');

  const [domainTarget, setDomainTarget] = useState<SiteApp | null>(null);
  const [newDomain, setNewDomain] = useState('');

  const [overrideTarget, setOverrideTarget] = useState<SiteApp | null>(null);
  const [disabledFeatures, setDisabledFeatures] = useState('');

  const [themeTarget, setThemeTarget] = useState<SiteApp | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [appsResponse, platformsResponse] = await Promise.all([
        fetch('/api/apps', { cache: 'no-store' }),
        fetch('/api/platforms', { cache: 'no-store' }),
      ]);
      const appsPayload = await appsResponse.json();
      const platformsPayload = await platformsResponse.json();

      if (!appsResponse.ok) throw new Error(appsPayload.error || 'ไม่สามารถอ่านรายการ Tenant App ได้');
      setApps(appsPayload.apps as SiteApp[]);
      if (platformsResponse.ok) {
        setPlatforms(platformsPayload.platforms as PlatformConfig[]);
        if (!platformId && platformsPayload.platforms?.[0]) {
          setPlatformId(platformsPayload.platforms[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [platformId]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProvision = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId,
          appName,
          appSlug,
          subdomain: subdomain || undefined,
          port: port ? Number(port) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'สร้าง Tenant App ไม่สำเร็จ');

      setProvisionOpen(false);
      setAppName('');
      setAppSlug('');
      setSubdomain('');
      setPort('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้าง Tenant App ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleAddDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!domainTarget) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${domainTarget.appId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'เพิ่มโดเมนไม่สำเร็จ');
      setNewDomain('');
      await loadData();
      setDomainTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มโดเมนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveDomain = async (app: SiteApp, domain: string) => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/apps/${app.appId}/domains?domain=${encodeURIComponent(domain)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ลบโดเมนไม่สำเร็จ');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบโดเมนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOverrides = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!overrideTarget) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${overrideTarget.appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantOverrides: {
            ...overrideTarget.tenantOverrides,
            disabledFeatures: disabledFeatures.split(',').map((value) => value.trim()).filter(Boolean),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึก Overrides ไม่สำเร็จ');
      setOverrideTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึก Overrides ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTheme = async (theme: ThemeConfig) => {
    if (!themeTarget) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${themeTarget.appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig: theme }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึกธีมไม่สำเร็จ');
      setThemeTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกธีมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (app: SiteApp) => {
    if (!window.confirm(`ลบ Tenant App "${app.appName}" ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${app.appId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ลบ Tenant App ไม่สำเร็จ');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบ Tenant App ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const platformName = (id: string | null) =>
    platforms.find((platform) => platform.id === id)?.platformName ?? '—';

  return (
    <div className="container-fluid p-0">
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <Box className="text-primary" size={24} /> Tenant Apps (Multi-Site)
          </h4>
          <p className="text-secondary small mb-0">
            แต่ละ Site มีพอร์ต โดเมน และฐานข้อมูลของตัวเอง — เริ่มทุก Site ด้วย
            <code className="ms-1">npm run sites</code>
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={`me-1 ${loading ? 'spin' : ''}`} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm fw-semibold" onClick={() => setProvisionOpen(true)}>
            <Plus size={15} className="me-1" /> Provision Tenant App
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger border-0 rounded-3 small">{error}</div>}

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" /> กำลังโหลด…
        </div>
      ) : apps.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-3 p-5 text-center text-muted">
          ยังไม่มี Tenant App — กด &ldquo;Provision Tenant App&rdquo; เพื่อแตก Site ใหม่จาก Platform Master
        </div>
      ) : (
        <div className="row g-3">
          {apps.map((app) => (
            <div className="col-12 col-xl-6" key={app.appId}>
              <div className="card border-0 shadow-sm rounded-3 h-100">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h6 className="fw-bold mb-1 text-dark">{app.appName}</h6>
                      <code className="small text-secondary">{app.appSlug}</code>
                      <div className="mt-2">
                        <span className="badge bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center gap-1">
                          <Layers size={12} /> Inherited from: {platformName(app.platformId)}
                        </span>
                      </div>
                    </div>
                    <span className={`badge ${app.isActive ? 'bg-success' : 'bg-secondary'}`}>
                      {app.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="row g-2 small text-secondary mb-3">
                    <div className="col-6 d-flex align-items-center gap-1">
                      <Server size={14} /> Port <span className="fw-semibold text-dark">:{app.port}</span>
                    </div>
                    <div className="col-6 d-flex align-items-center gap-1">
                      <Database size={14} /> <span className="font-monospace">{app.tenantDbName}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="small text-secondary mb-1 d-flex align-items-center gap-1">
                      <Globe size={14} /> โดเมนที่ผูกไว้
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {app.domains.length === 0 && <span className="small text-muted">ยังไม่มีโดเมน</span>}
                      {app.domains.map((domain) => (
                        <span key={domain} className="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
                          {domain}
                          {domain !== app.subdomain && (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-danger lh-1"
                              onClick={() => void handleRemoveDomain(app, domain)}
                              aria-label={`ลบโดเมน ${domain}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 d-flex align-items-center gap-2">
                    <span
                      className="rounded-circle border"
                      style={{ width: 18, height: 18, background: app.themeConfig?.primaryColor ?? '#0d6efd' }}
                      aria-hidden="true"
                    />
                    <span className="small text-secondary">
                      ธีม: <span className="fw-semibold text-dark">{app.themeConfig?.preset ?? 'modern-indigo'}</span>
                      {' · '}{app.themeConfig?.mode ?? 'light'}
                    </span>
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <Link href={`/app/${app.appSlug}`} className="btn btn-sm btn-outline-primary">
                      <ExternalLink size={14} className="me-1" /> เปิด Site
                    </Link>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => { setDomainTarget(app); setNewDomain(''); }}
                    >
                      <Globe size={14} className="me-1" /> จัดการโดเมน
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setThemeTarget(app)}>
                      <Palette size={14} className="me-1" /> ธีม
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setOverrideTarget(app);
                        setDisabledFeatures((app.tenantOverrides?.disabledFeatures ?? []).join(', '));
                      }}
                    >
                      <Sliders size={14} className="me-1" /> Overrides
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => void handleDelete(app)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Provision modal */}
      {isProvisionOpen && (
        <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.6)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <form className="modal-content border-0 shadow" onSubmit={handleProvision}>
              <div className="modal-header">
                <h6 className="modal-title fw-bold">Provision Tenant App ใหม่</h6>
                <button type="button" className="btn-close" onClick={() => setProvisionOpen(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="platform" className="form-label small fw-semibold">Platform Master</label>
                  <select
                    id="platform"
                    className="form-select"
                    value={platformId}
                    onChange={(event) => setPlatformId(event.target.value)}
                    required
                  >
                    <option value="">เลือก Platform…</option>
                    {platforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>{platform.platformName}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="appName" className="form-label small fw-semibold">ชื่อ App</label>
                  <input id="appName" className="form-control" value={appName}
                         onChange={(event) => setAppName(event.target.value)} required />
                </div>
                <div className="mb-3">
                  <label htmlFor="appSlug" className="form-label small fw-semibold">Slug</label>
                  <input id="appSlug" className="form-control font-monospace" value={appSlug}
                         onChange={(event) => setAppSlug(event.target.value.toLowerCase())}
                         pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
                  <div className="form-text">ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง</div>
                </div>
                <div className="row g-2">
                  <div className="col-7">
                    <label htmlFor="subdomain" className="form-label small fw-semibold">โดเมนหลัก (ไม่บังคับ)</label>
                    <input id="subdomain" className="form-control font-monospace" value={subdomain}
                           onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
                           placeholder={appSlug ? `${appSlug}.localhost` : 'example.go.th'} />
                  </div>
                  <div className="col-5">
                    <label htmlFor="port" className="form-label small fw-semibold">พอร์ต (ไม่บังคับ)</label>
                    <input id="port" type="number" className="form-control" value={port}
                           onChange={(event) => setPort(event.target.value)} placeholder="auto" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setProvisionOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'กำลังสร้าง…' : 'สร้าง Tenant App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Domain modal */}
      {domainTarget && (
        <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.6)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <form className="modal-content border-0 shadow" onSubmit={handleAddDomain}>
              <div className="modal-header">
                <h6 className="modal-title fw-bold">โดเมนของ {domainTarget.appName}</h6>
                <button type="button" className="btn-close" onClick={() => setDomainTarget(null)} />
              </div>
              <div className="modal-body">
                <label htmlFor="newDomain" className="form-label small fw-semibold">เพิ่มโดเมนใหม่</label>
                <input id="newDomain" className="form-control font-monospace" value={newDomain}
                       onChange={(event) => setNewDomain(event.target.value.toLowerCase())}
                       placeholder="www.example.go.th" required />
                <div className="form-text">
                  หนึ่งโดเมนผูกได้กับ Site เดียวเท่านั้น หลังเพิ่มแล้วให้ restart ด้วย <code>npm run sites</code>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setDomainTarget(null)}>ปิด</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>เพิ่มโดเมน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SiteThemeModal
        isOpen={Boolean(themeTarget)}
        siteName={themeTarget?.appName ?? ''}
        initialTheme={themeTarget?.themeConfig ?? {
          preset: 'modern-indigo', mode: 'light', primaryColor: '#0d6efd',
          borderRadius: '0.375rem', fontFamily: 'Inter, sans-serif',
        }}
        isSaving={busy}
        onClose={() => setThemeTarget(null)}
        onSave={(theme) => void handleSaveTheme(theme)}
      />

      {/* Tenant overrides modal */}
      {overrideTarget && (
        <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.6)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <form className="modal-content border-0 shadow" onSubmit={handleSaveOverrides}>
              <div className="modal-header">
                <h6 className="modal-title fw-bold">Tenant Overrides — {overrideTarget.appName}</h6>
                <button type="button" className="btn-close" onClick={() => setOverrideTarget(null)} />
              </div>
              <div className="modal-body">
                <label htmlFor="disabled" className="form-label small fw-semibold">
                  ปิดการใช้งาน Component (คั่นด้วยจุลภาค)
                </label>
                <input id="disabled" className="form-control font-monospace" value={disabledFeatures}
                       onChange={(event) => setDisabledFeatures(event.target.value)}
                       placeholder="ChartComponent, home_hero" />
                <div className="form-text">
                  ใส่ Component ID หรือ Component Type ที่ต้องการซ่อนจาก Master Layout ของ Platform
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setOverrideTarget(null)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
