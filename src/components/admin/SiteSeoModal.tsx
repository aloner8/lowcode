'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Save, Globe, Share2, ShieldCheck } from 'lucide-react';

/**
 * Per-site SEO editor.
 *
 * Empty fields fall back to the Platform Master defaults, so a tenant only
 * fills in what it actually wants to override.
 */

export interface SiteSeoValue {
  siteName: string;
  description: string;
  keywords: string;
  locale: string;
  language: string;
  ogImage: string;
  twitterHandle: string;
  organizationType: string;
  robots: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
  sitemapEnabled: boolean;
}

interface SiteSeoModalProps {
  readonly isOpen: boolean;
  readonly siteName: string;
  readonly primaryDomain: string;
  readonly initialValue: Record<string, unknown>;
  readonly isSaving?: boolean;
  readonly onClose: () => void;
  readonly onSave: (value: Record<string, unknown>) => void;
}

const ORGANIZATION_TYPES = [
  'GovernmentOrganization', 'Organization', 'LocalBusiness', 'Corporation',
  'EducationalOrganization', 'NGO', 'MedicalOrganization',
];

const ROBOTS_OPTIONS = [
  { value: 'index,follow', label: 'index,follow — ให้ค้นเจอ (แนะนำ)' },
  { value: 'noindex,nofollow', label: 'noindex,nofollow — ซ่อนจาก Search Engine' },
  { value: 'index,nofollow', label: 'index,nofollow' },
  { value: 'noindex,follow', label: 'noindex,follow' },
];

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export default function SiteSeoModal({
  isOpen,
  siteName,
  primaryDomain,
  initialValue,
  isSaving = false,
  onClose,
  onSave,
}: SiteSeoModalProps) {
  const [value, setValue] = useState<SiteSeoValue>({
    siteName: '', description: '', keywords: '', locale: 'th_TH', language: 'th',
    ogImage: '', twitterHandle: '', organizationType: 'GovernmentOrganization',
    robots: 'index,follow', googleSiteVerification: '', bingSiteVerification: '',
    sitemapEnabled: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const keywords = Array.isArray(initialValue.keywords)
      ? (initialValue.keywords as string[]).join(', ')
      : text(initialValue.keywords);

    setValue({
      siteName: text(initialValue.siteName),
      description: text(initialValue.description),
      keywords,
      locale: text(initialValue.locale) || 'th_TH',
      language: text(initialValue.language) || 'th',
      ogImage: text(initialValue.ogImage),
      twitterHandle: text(initialValue.twitterHandle),
      organizationType: text(initialValue.organizationType) || 'GovernmentOrganization',
      robots: text(initialValue.robots) || 'index,follow',
      googleSiteVerification: text(initialValue.googleSiteVerification),
      bingSiteVerification: text(initialValue.bingSiteVerification),
      sitemapEnabled: initialValue.sitemapEnabled !== false,
    });
  }, [isOpen, initialValue]);

  const update = <K extends keyof SiteSeoValue>(key: K, next: SiteSeoValue[K]) =>
    setValue((previous) => ({ ...previous, [key]: next }));

  const previewTitle = useMemo(
    () => value.siteName || siteName,
    [value.siteName, siteName],
  );

  if (!isOpen) return null;

  const titleLength = previewTitle.length;
  const descriptionLength = value.description.length;

  return (
    <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.6)', zIndex: 1050 }} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow rounded-3">
          <div className="modal-header">
            <h6 className="modal-title fw-bold d-flex align-items-center gap-2">
              <Search size={18} className="text-primary" /> SEO — {siteName}
            </h6>
            <button type="button" className="btn-close" onClick={onClose} aria-label="ปิด" />
          </div>

          <div className="modal-body">
            {/* Google result preview */}
            <div className="border rounded-3 p-3 mb-4 bg-light">
              <p className="extra-small text-secondary mb-2 fw-semibold">ตัวอย่างผลการค้นหา</p>
              <div style={{ fontFamily: 'arial, sans-serif' }}>
                <div className="small text-success">{`https://${primaryDomain}`}</div>
                <div style={{ color: '#1a0dab', fontSize: '1.05rem' }} className="text-truncate">
                  {previewTitle || 'ชื่อเว็บไซต์'}
                </div>
                <div style={{ color: '#4d5156', fontSize: '0.85rem' }}>
                  {value.description || 'ยังไม่ได้ตั้งคำอธิบาย — Search Engine จะเลือกข้อความจากหน้าเว็บเอง'}
                </div>
              </div>
            </div>

            <fieldset className="mb-4">
              <legend className="form-label small fw-semibold d-flex align-items-center gap-1">
                <Globe size={14} /> ข้อมูลพื้นฐาน
              </legend>

              <div className="mb-3">
                <label htmlFor="seoSiteName" className="form-label small">
                  ชื่อเว็บไซต์
                  <span className={`ms-2 extra-small ${titleLength > TITLE_LIMIT ? 'text-danger' : 'text-secondary'}`}>
                    {titleLength}/{TITLE_LIMIT}
                  </span>
                </label>
                <input id="seoSiteName" className="form-control" value={value.siteName}
                       onChange={(event) => update('siteName', event.target.value)}
                       placeholder={siteName} />
              </div>

              <div className="mb-3">
                <label htmlFor="seoDescription" className="form-label small">
                  คำอธิบาย (Meta Description)
                  <span className={`ms-2 extra-small ${descriptionLength > DESCRIPTION_LIMIT ? 'text-danger' : 'text-secondary'}`}>
                    {descriptionLength}/{DESCRIPTION_LIMIT}
                  </span>
                </label>
                <textarea id="seoDescription" className="form-control" rows={3} value={value.description}
                          onChange={(event) => update('description', event.target.value)}
                          placeholder="อธิบายเว็บไซต์ใน 1–2 ประโยค" />
              </div>

              <div className="mb-3">
                <label htmlFor="seoKeywords" className="form-label small">คำค้น (คั่นด้วยจุลภาค)</label>
                <input id="seoKeywords" className="form-control" value={value.keywords}
                       onChange={(event) => update('keywords', event.target.value)}
                       placeholder="เทศบาล, บริการประชาชน, ข่าวสาร" />
              </div>

              <div className="row g-2">
                <div className="col-md-4">
                  <label htmlFor="seoLanguage" className="form-label small">ภาษา (lang)</label>
                  <input id="seoLanguage" className="form-control font-monospace" value={value.language}
                         onChange={(event) => update('language', event.target.value)} placeholder="th" />
                </div>
                <div className="col-md-4">
                  <label htmlFor="seoLocale" className="form-label small">Locale (og:locale)</label>
                  <input id="seoLocale" className="form-control font-monospace" value={value.locale}
                         onChange={(event) => update('locale', event.target.value)} placeholder="th_TH" />
                </div>
                <div className="col-md-4">
                  <label htmlFor="seoOrgType" className="form-label small">ประเภทองค์กร</label>
                  <select id="seoOrgType" className="form-select" value={value.organizationType}
                          onChange={(event) => update('organizationType', event.target.value)}>
                    {ORGANIZATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className="mb-4">
              <legend className="form-label small fw-semibold d-flex align-items-center gap-1">
                <Share2 size={14} /> การแชร์บนโซเชียล
              </legend>
              <div className="row g-2">
                <div className="col-md-8">
                  <label htmlFor="seoOgImage" className="form-label small">รูปภาพ OG (1200×630)</label>
                  <input id="seoOgImage" className="form-control font-monospace" value={value.ogImage}
                         onChange={(event) => update('ogImage', event.target.value)}
                         placeholder="https://… หรือ /api/platforms/…/assets/…" />
                </div>
                <div className="col-md-4">
                  <label htmlFor="seoTwitter" className="form-label small">X / Twitter</label>
                  <input id="seoTwitter" className="form-control font-monospace" value={value.twitterHandle}
                         onChange={(event) => update('twitterHandle', event.target.value)} placeholder="@handle" />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="form-label small fw-semibold d-flex align-items-center gap-1">
                <ShieldCheck size={14} /> การจัดทำดัชนีและการยืนยันสิทธิ์
              </legend>

              <div className="mb-3">
                <label htmlFor="seoRobots" className="form-label small">นโยบาย Robots</label>
                <select id="seoRobots" className="form-select" value={value.robots}
                        onChange={(event) => update('robots', event.target.value)}>
                  {ROBOTS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-check mb-3">
                <input id="seoSitemap" type="checkbox" className="form-check-input"
                       checked={value.sitemapEnabled}
                       onChange={(event) => update('sitemapEnabled', event.target.checked)} />
                <label htmlFor="seoSitemap" className="form-check-label small">
                  สร้าง <code>/sitemap.xml</code> และประกาศใน <code>robots.txt</code>
                </label>
              </div>

              <div className="row g-2">
                <div className="col-md-6">
                  <label htmlFor="seoGoogle" className="form-label small">Google Search Console</label>
                  <input id="seoGoogle" className="form-control font-monospace" value={value.googleSiteVerification}
                         onChange={(event) => update('googleSiteVerification', event.target.value)}
                         placeholder="google-site-verification token" />
                </div>
                <div className="col-md-6">
                  <label htmlFor="seoBing" className="form-label small">Bing Webmaster</label>
                  <input id="seoBing" className="form-control font-monospace" value={value.bingSiteVerification}
                         onChange={(event) => update('bingSiteVerification', event.target.value)}
                         placeholder="msvalidate.01 token" />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose}>ยกเลิก</button>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2"
              disabled={isSaving}
              onClick={() => onSave({
                ...value,
                keywords: value.keywords.split(',').map((item) => item.trim()).filter(Boolean),
              })}
            >
              <Save size={16} /> {isSaving ? 'กำลังบันทึก…' : 'บันทึก SEO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
