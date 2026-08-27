'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, ExternalLink, Globe, Trash2, Sliders, RefreshCw, Palette, Search, Inbox, AlertCircle,
} from 'lucide-react';
import SiteThemeModal from '@/components/admin/SiteThemeModal';
import SiteSeoModal from '@/components/admin/SiteSeoModal';
import AdminModal from '@/components/admin/AdminModal';
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
  seoSettings: Record<string, unknown>;
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
  const [seoTarget, setSeoTarget] = useState<SiteApp | null>(null);

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

      if (!appsResponse.ok) throw new Error(appsPayload.error || 'ไม่สามารถอ่านรายการเว็บไซต์ได้');
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
      if (!response.ok) throw new Error(payload.error || 'สร้างเว็บไซต์ไม่สำเร็จ');

      setProvisionOpen(false);
      setAppName('');
      setAppSlug('');
      setSubdomain('');
      setPort('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเว็บไซต์ไม่สำเร็จ');
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
      if (!response.ok) throw new Error(payload.error || 'บันทึกการปรับแต่งไม่สำเร็จ');
      setOverrideTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกการปรับแต่งไม่สำเร็จ');
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

  const handleSaveSeo = async (seoSettings: Record<string, unknown>) => {
    if (!seoTarget) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${seoTarget.appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seoSettings }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึก SEO ไม่สำเร็จ');
      setSeoTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึก SEO ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (app: SiteApp) => {
    if (!window.confirm(`ลบเว็บไซต์ "${app.appName}" ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${app.appId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ลบเว็บไซต์ไม่สำเร็จ');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบเว็บไซต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const platformName = (id: string | null) =>
    platforms.find((platform) => platform.id === id)?.platformName ?? '—';

  return (
    <div className="d-flex flex-column gap-3">
      <div className="adm-toolbar">
        <p className="adm-toolbar-note">
          แต่ละเว็บไซต์มีพอร์ต โดเมน และฐานข้อมูลของตัวเอง —
          หลังเพิ่มหรือแก้โดเมนให้เริ่มบริการใหม่ด้วย <code>npm run sites</code>
        </p>
        <div className="d-flex gap-2">
          <button type="button" className="adm-btn is-quiet is-sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'adm-spin' : ''} aria-hidden="true" /> โหลดใหม่
          </button>
          <button type="button" className="adm-btn is-sm" onClick={() => setProvisionOpen(true)}>
            <Plus size={15} aria-hidden="true" /> เพิ่มเว็บไซต์
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert is-danger" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="adm-card adm-empty">
          <RefreshCw size={22} className="adm-spin mb-2" aria-hidden="true" />
          <p className="adm-empty-text">กำลังโหลด…</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="adm-card adm-empty">
          <span className="adm-empty-icon"><Inbox size={22} aria-hidden="true" /></span>
          <p className="adm-empty-title">ยังไม่มีเว็บไซต์</p>
          <p className="adm-empty-text">กด &ldquo;เพิ่มเว็บไซต์&rdquo; เพื่อสร้างเว็บใหม่จากแม่แบบระบบ</p>
        </div>
      ) : (
        <div className="row g-3">
          {apps.map((app) => (
            <div className="col-12 col-xxl-6 d-flex" key={app.appId}>
              <section className="adm-card h-100 d-flex flex-column">
                <div className="adm-card-head">
                  <div className="min-w-0">
                    <h2 className="adm-card-title">{app.appName}</h2>
                    <p className="adm-cell-sub mb-0 font-monospace">{app.appSlug}</p>
                  </div>
                  {app.isActive ? (
                    <span className="adm-chip is-ok">
                      <span className="adm-chip-dot" aria-hidden="true" /> เปิดใช้งาน
                    </span>
                  ) : (
                    <span className="adm-chip is-off">ปิดใช้งาน</span>
                  )}
                </div>

                <div className="p-3 flex-grow-1 d-flex flex-column gap-3">
                  <dl className="adm-facts">
                    <div>
                      <dt>สร้างจากแม่แบบ</dt>
                      <dd>{platformName(app.platformId)}</dd>
                    </div>
                    <div>
                      <dt>พอร์ต</dt>
                      <dd className="font-monospace">{app.port}</dd>
                    </div>
                    <div>
                      <dt>ธีมที่ใช้</dt>
                      <dd className="d-flex align-items-center gap-2">
                        <span
                          className="adm-swatch"
                          style={{ background: app.themeConfig?.primaryColor ?? '#0d6efd' }}
                          aria-hidden="true"
                        />
                        {app.themeConfig?.preset ?? 'modern-indigo'}
                      </dd>
                    </div>
                    <div>
                      <dt>ฐานข้อมูล</dt>
                      <dd className="font-monospace text-truncate">{app.tenantDbName}</dd>
                    </div>
                  </dl>

                  <div>
                    <p className="adm-label d-flex align-items-center gap-1 mb-2">
                      <Globe size={14} aria-hidden="true" /> โดเมนที่ผูกไว้
                    </p>
                    <div className="d-flex flex-wrap gap-1">
                      {app.domains.length === 0 && (
                        <span className="adm-cell-sub">ยังไม่มีโดเมน</span>
                      )}
                      {app.domains.map((domain) => {
                        const isPrimary = domain === app.subdomain;
                        return (
                          <span key={domain} className={`adm-tag ${isPrimary ? 'is-fixed' : ''}`}>
                            {domain}
                            {!isPrimary && (
                              <button
                                type="button"
                                className="adm-tag-remove"
                                onClick={() => void handleRemoveDomain(app, domain)}
                                aria-label={`ลบโดเมน ${domain}`}
                                disabled={busy}
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-auto pt-1">
                    <Link href={`/app/${app.appSlug}`} className="adm-btn is-quiet is-sm">
                      <ExternalLink size={14} aria-hidden="true" /> เปิดเว็บไซต์
                    </Link>
                    <button
                      type="button"
                      className="adm-btn is-quiet is-sm"
                      onClick={() => { setDomainTarget(app); setNewDomain(''); }}
                    >
                      <Globe size={14} aria-hidden="true" /> โดเมน
                    </button>
                    <button type="button" className="adm-btn is-quiet is-sm" onClick={() => setThemeTarget(app)}>
                      <Palette size={14} aria-hidden="true" /> ธีม
                    </button>
                    <button type="button" className="adm-btn is-quiet is-sm" onClick={() => setSeoTarget(app)}>
                      <Search size={14} aria-hidden="true" /> SEO
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-quiet is-sm"
                      onClick={() => {
                        setOverrideTarget(app);
                        setDisabledFeatures((app.tenantOverrides?.disabledFeatures ?? []).join(', '));
                      }}
                    >
                      <Sliders size={14} aria-hidden="true" /> ปรับแต่ง
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-danger is-sm ms-auto"
                      onClick={() => void handleDelete(app)}
                      aria-label={`ลบเว็บไซต์ ${app.appName}`}
                    >
                      <Trash2 size={14} aria-hidden="true" /> ลบ
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ))}
        </div>
      )}

      <AdminModal
        isOpen={isProvisionOpen}
        title="เพิ่มเว็บไซต์ใหม่"
        subtitle="สร้างเว็บของหน่วยงานจากแม่แบบระบบ พร้อมฐานข้อมูลของตัวเอง"
        onClose={() => setProvisionOpen(false)}
        onSubmit={handleProvision}
        footer={
          <>
            <button type="button" className="adm-btn is-quiet" onClick={() => setProvisionOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="adm-btn" disabled={busy}>
              {busy ? 'กำลังสร้าง…' : 'สร้างเว็บไซต์'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label htmlFor="platform" className="adm-label d-block">แม่แบบระบบ</label>
          <select
            id="platform"
            className="adm-select"
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
            required
          >
            <option value="">เลือกแม่แบบ…</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.platformName}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="appName" className="adm-label d-block">ชื่อหน่วยงาน</label>
          <input
            id="appName"
            className="adm-input"
            value={appName}
            onChange={(event) => setAppName(event.target.value)}
            placeholder="เทศบาลตำบลตัวอย่าง"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="appSlug" className="adm-label d-block">ชื่อย่อสำหรับระบบ (slug)</label>
          <input
            id="appSlug"
            className="adm-input is-mono"
            value={appSlug}
            onChange={(event) => setAppSlug(event.target.value.toLowerCase())}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="tambon-example"
            required
          />
          <p className="adm-help">ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง — เปลี่ยนภายหลังไม่ได้</p>
        </div>
        <div className="row g-2">
          <div className="col-12 col-sm-7">
            <label htmlFor="subdomain" className="adm-label d-block">โดเมนหลัก</label>
            <input
              id="subdomain"
              className="adm-input is-mono"
              value={subdomain}
              onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
              placeholder={appSlug ? `${appSlug}.localhost` : 'example.go.th'}
            />
            <p className="adm-help">เว้นว่างได้ ระบบจะตั้งให้อัตโนมัติ</p>
          </div>
          <div className="col-12 col-sm-5">
            <label htmlFor="port" className="adm-label d-block">พอร์ต</label>
            <input
              id="port"
              type="number"
              className="adm-input"
              value={port}
              onChange={(event) => setPort(event.target.value)}
              placeholder="อัตโนมัติ"
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        isOpen={Boolean(domainTarget)}
        title="เพิ่มโดเมน"
        subtitle={domainTarget?.appName}
        onClose={() => setDomainTarget(null)}
        onSubmit={handleAddDomain}
        footer={
          <>
            <button type="button" className="adm-btn is-quiet" onClick={() => setDomainTarget(null)}>
              ปิด
            </button>
            <button type="submit" className="adm-btn" disabled={busy}>เพิ่มโดเมน</button>
          </>
        }
      >
        <label htmlFor="newDomain" className="adm-label d-block">ชื่อโดเมน</label>
        <input
          id="newDomain"
          className="adm-input is-mono"
          value={newDomain}
          onChange={(event) => setNewDomain(event.target.value.toLowerCase())}
          placeholder="www.example.go.th"
          required
        />
        <p className="adm-help">
          หนึ่งโดเมนผูกได้กับเว็บไซต์เดียวเท่านั้น หลังเพิ่มแล้วให้เริ่มบริการใหม่ด้วย <code>npm run sites</code>
        </p>

        {domainTarget && domainTarget.domains.length > 0 && (
          <div className="mt-3">
            <p className="adm-label d-block mb-2">โดเมนที่ผูกไว้แล้ว</p>
            <div className="d-flex flex-wrap gap-1">
              {domainTarget.domains.map((domain) => (
                <span key={domain} className="adm-tag is-fixed">{domain}</span>
              ))}
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        isOpen={Boolean(overrideTarget)}
        title="ปรับแต่งเฉพาะเว็บไซต์นี้"
        subtitle={overrideTarget?.appName}
        onClose={() => setOverrideTarget(null)}
        onSubmit={handleSaveOverrides}
        footer={
          <>
            <button type="button" className="adm-btn is-quiet" onClick={() => setOverrideTarget(null)}>
              ยกเลิก
            </button>
            <button type="submit" className="adm-btn" disabled={busy}>บันทึก</button>
          </>
        }
      >
        <label htmlFor="disabled" className="adm-label d-block">ส่วนที่ต้องการซ่อน</label>
        <input
          id="disabled"
          className="adm-input is-mono"
          value={disabledFeatures}
          onChange={(event) => setDisabledFeatures(event.target.value)}
          placeholder="ChartComponent, home_hero"
        />
        <p className="adm-help">
          ใส่ชื่อหรือรหัสของส่วนประกอบที่ไม่ต้องการให้แสดงบนเว็บนี้ คั่นแต่ละรายการด้วยจุลภาค
          ส่วนที่เหลือจะยังทำงานตามแม่แบบระบบ
        </p>
      </AdminModal>

      <SiteThemeModal
        isOpen={Boolean(themeTarget)}
        siteName={themeTarget?.appName ?? ''}
        initialTheme={themeTarget?.themeConfig ?? {
          preset: 'modern-indigo', mode: 'light', primaryColor: '#0d6efd',
          borderRadius: '0.375rem', fontFamily: 'Anuphan, sans-serif',
        }}
        isSaving={busy}
        onClose={() => setThemeTarget(null)}
        onSave={(theme) => void handleSaveTheme(theme)}
      />

      <SiteSeoModal
        isOpen={Boolean(seoTarget)}
        siteName={seoTarget?.appName ?? ''}
        primaryDomain={seoTarget?.domains[0] ?? seoTarget?.subdomain ?? ''}
        initialValue={seoTarget?.seoSettings ?? {}}
        isSaving={busy}
        onClose={() => setSeoTarget(null)}
        onSave={(value) => void handleSaveSeo(value)}
      />
    </div>
  );
}
