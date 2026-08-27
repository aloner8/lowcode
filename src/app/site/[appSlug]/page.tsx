import React from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { CalendarClock, Users, Globe, HardDrive, AlertTriangle, CheckCircle2, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface OverviewRow {
  id: string;
  app_name: string;
  package_name: string;
  package_code: string;
  package_started_at: Date;
  package_expires_at: Date | null;
  package_limits: { maxUsers?: number; maxStorageMb?: number; maxDomains?: number };
  is_suspended: boolean;
  suspended_reason: string | null;
  seats: string;
  domain_count: string;
  role: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Overview of one agency's Site: package, expiry and quota usage. */
export default async function SiteOverviewPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}) {
  const { appSlug } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const result = await getCoreDb().query<OverviewRow>(
    `SELECT a.id, a.app_name, a.package_name, a.package_code,
            a.package_started_at, a.package_expires_at, a.package_limits,
            a.is_suspended, a.suspended_reason,
            (SELECT COUNT(*)::text FROM public.app_memberships m WHERE m.app_id = a.id) AS seats,
            (SELECT COUNT(*)::text FROM public.app_domains d WHERE d.app_id = a.id AND d.is_active) AS domain_count,
            public.site_role_of($2, a.id) AS role
     FROM public.apps a WHERE a.app_slug = $1 AND a.is_active`,
    [appSlug, user.id],
  );
  if (!result.rowCount || !result.rows[0].role) notFound();

  const site = result.rows[0];
  const expiresAt = site.package_expires_at;
  const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS) : null;
  const limits = site.package_limits ?? {};

  const expiryTone =
    daysRemaining === null ? 'is-off'
      : daysRemaining < 0 ? 'is-danger'
      : daysRemaining <= 30 ? 'is-warn'
      : 'is-ok';

  const quotas = [
    { label: 'ผู้ใช้', icon: Users, used: Number(site.seats), max: limits.maxUsers },
    { label: 'โดเมน', icon: Globe, used: Number(site.domain_count), max: limits.maxDomains },
    { label: 'พื้นที่ (MB)', icon: HardDrive, used: null, max: limits.maxStorageMb },
  ];

  return (
    <div className="d-flex flex-column gap-3">
      {site.is_suspended && (
        <div className="adm-alert is-danger" role="alert">
          <AlertTriangle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>
            <strong>เว็บไซต์ถูกระงับการใช้งาน</strong>
            <span className="d-block">{site.suspended_reason || 'กรุณาติดต่อผู้ให้บริการ'}</span>
          </span>
        </div>
      )}

      {daysRemaining !== null && daysRemaining <= 30 && !site.is_suspended && (
        <div className={`adm-alert ${daysRemaining < 0 ? 'is-danger' : 'is-warn'}`}>
          <CalendarClock size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>
            {daysRemaining < 0
              ? `แพ็กเกจหมดอายุแล้ว ${Math.abs(daysRemaining)} วัน — กรุณาติดต่อผู้ให้บริการเพื่อต่ออายุ`
              : `แพ็กเกจจะหมดอายุในอีก ${daysRemaining} วัน`}
          </span>
        </div>
      )}

      <div className="row g-3 align-items-start">
        <div className="col-12 col-lg-5">
          <section className="adm-card h-100">
            <div className="adm-card-head">
              <h2 className="adm-card-title">
                <Package size={17} aria-hidden="true" /> แพ็กเกจการใช้งาน
              </h2>
            </div>
            <div className="p-3">
              <dl className="mb-0 d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <dt className="adm-stat-label fw-normal">แพ็กเกจ</dt>
                  <dd className="adm-cell-strong mb-0 d-flex align-items-center gap-2">
                    {site.package_name}
                    <span className="adm-chip is-info">{site.package_code}</span>
                  </dd>
                </div>
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <dt className="adm-stat-label fw-normal">เริ่มใช้งาน</dt>
                  <dd className="adm-cell-strong mb-0">
                    {site.package_started_at.toLocaleDateString('th-TH')}
                  </dd>
                </div>
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <dt className="adm-stat-label fw-normal">วันหมดอายุ</dt>
                  <dd className="mb-0">
                    {expiresAt ? (
                      <span className={`adm-chip ${expiryTone}`}>
                        {expiresAt.toLocaleDateString('th-TH')}
                      </span>
                    ) : (
                      <span className="adm-cell-sub">ไม่มีกำหนด</span>
                    )}
                  </dd>
                </div>
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <dt className="adm-stat-label fw-normal">สถานะ</dt>
                  <dd className="mb-0">
                    {site.is_suspended ? (
                      <span className="adm-chip is-danger">ระงับการใช้งาน</span>
                    ) : (
                      <span className="adm-chip is-ok">
                        <CheckCircle2 size={12} aria-hidden="true" /> ใช้งานได้
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <section className="adm-card h-100">
            <div className="adm-card-head">
              <h2 className="adm-card-title">โควตาการใช้งาน</h2>
            </div>
            <div className="p-3 d-flex flex-column gap-3">
              {quotas.map((quota) => {
                const percent = quota.max && quota.used !== null
                  ? Math.min(Math.round((quota.used / quota.max) * 100), 100)
                  : null;
                const tone = percent === null ? '' : percent >= 90 ? 'is-full' : percent >= 75 ? 'is-near' : '';
                return (
                  <div key={quota.label}>
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                      <span className="adm-stat-label d-flex align-items-center gap-1 fw-normal">
                        <quota.icon size={14} aria-hidden="true" /> {quota.label}
                      </span>
                      <span className="adm-cell-strong">
                        {quota.used ?? '—'} / {quota.max ?? 'ไม่จำกัด'}
                      </span>
                    </div>
                    {percent !== null && (
                      <div
                        className={`adm-meter ${tone}`}
                        role="progressbar"
                        aria-label={`${quota.label} ใช้ไป ${percent}%`}
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="adm-help mb-0">
                ต้องการเพิ่มโควตาหรือต่ออายุ กรุณาติดต่อผู้ให้บริการ (บริษัท หนุมานไอที จำกัด)
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
