import React from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { CalendarClock, Users, Globe, HardDrive, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
    daysRemaining === null ? 'secondary'
      : daysRemaining < 0 ? 'danger'
      : daysRemaining <= 30 ? 'warning'
      : 'success';

  const quotas = [
    { label: 'ผู้ใช้', icon: Users, used: Number(site.seats), max: limits.maxUsers },
    { label: 'โดเมน', icon: Globe, used: Number(site.domain_count), max: limits.maxDomains },
    { label: 'พื้นที่ (MB)', icon: HardDrive, used: null, max: limits.maxStorageMb },
  ];

  return (
    <>
      {site.is_suspended && (
        <div className="alert alert-danger border-0 rounded-3 d-flex align-items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-1" />
          <div>
            <strong>เว็บไซต์ถูกระงับการใช้งาน</strong>
            <div className="small">{site.suspended_reason || 'กรุณาติดต่อผู้ให้บริการ'}</div>
          </div>
        </div>
      )}

      {daysRemaining !== null && daysRemaining <= 30 && !site.is_suspended && (
        <div className={`alert alert-${expiryTone} border-0 rounded-3 d-flex align-items-center gap-2`}>
          <CalendarClock size={18} />
          {daysRemaining < 0
            ? `แพ็กเกจหมดอายุแล้ว ${Math.abs(daysRemaining)} วัน — กรุณาติดต่อผู้ให้บริการเพื่อต่ออายุ`
            : `แพ็กเกจจะหมดอายุในอีก ${daysRemaining} วัน`}
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <section className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h2 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
                <CalendarClock size={18} className="text-primary" /> แพ็กเกจการใช้งาน
              </h2>
            </div>
            <div className="card-body p-4">
              <dl className="row mb-0 small">
                <dt className="col-5 fw-normal text-secondary">แพ็กเกจ</dt>
                <dd className="col-7 text-end fw-semibold">
                  {site.package_name}
                  <span className="badge bg-light text-secondary ms-2">{site.package_code}</span>
                </dd>

                <dt className="col-5 fw-normal text-secondary">เริ่มใช้งาน</dt>
                <dd className="col-7 text-end fw-semibold">
                  {site.package_started_at.toLocaleDateString('th-TH')}
                </dd>

                <dt className="col-5 fw-normal text-secondary">วันหมดอายุ</dt>
                <dd className="col-7 text-end">
                  {expiresAt ? (
                    <span className={`fw-semibold text-${expiryTone}`}>
                      {expiresAt.toLocaleDateString('th-TH')}
                    </span>
                  ) : (
                    <span className="text-secondary">ไม่มีกำหนด</span>
                  )}
                </dd>

                <dt className="col-5 fw-normal text-secondary">สถานะ</dt>
                <dd className="col-7 text-end mb-0">
                  {site.is_suspended ? (
                    <span className="badge bg-danger">ระงับการใช้งาน</span>
                  ) : (
                    <span className="badge bg-success d-inline-flex align-items-center gap-1">
                      <CheckCircle2 size={12} /> ใช้งานได้
                    </span>
                  )}
                </dd>
              </dl>
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <section className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h2 className="h6 fw-bold mb-0">โควตาการใช้งาน</h2>
            </div>
            <div className="card-body p-4 d-flex flex-column gap-3">
              {quotas.map((quota) => {
                const percent = quota.max && quota.used !== null
                  ? Math.min(Math.round((quota.used / quota.max) * 100), 100)
                  : null;
                return (
                  <div key={quota.label}>
                    <div className="d-flex justify-content-between align-items-center small mb-1">
                      <span className="d-flex align-items-center gap-1 text-secondary">
                        <quota.icon size={14} /> {quota.label}
                      </span>
                      <span className="fw-semibold">
                        {quota.used ?? '—'} / {quota.max ?? 'ไม่จำกัด'}
                      </span>
                    </div>
                    {percent !== null && (
                      <div className="progress" style={{ height: 6 }}>
                        <div
                          className={`progress-bar ${percent >= 90 ? 'bg-danger' : 'bg-primary'}`}
                          style={{ width: `${percent}%` }}
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="extra-small text-secondary mb-0">
                ต้องการเพิ่มโควตาหรือต่ออายุ กรุณาติดต่อผู้ให้บริการ (หนุมานไอที)
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
