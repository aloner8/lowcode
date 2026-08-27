import React from 'react';
import Link from 'next/link';
import { Box, Users, Layers, ScrollText, Palette, Plus, Globe, History, Inbox } from 'lucide-react';
import StatWidgetCard from '@/components/admin/StatWidgetCard';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { fetchPlatformAudit } from '@/lib/engine/AuditLogService';
import { auditActionLabel, auditActionTone } from '@/lib/admin/auditLabels';

export const dynamic = 'force-dynamic';

interface DashboardCounts {
  apps: number;
  users: number;
  platforms: number;
  pages: number;
  auditLogs: number;
}

interface SiteSummary {
  appId: string;
  appSlug: string;
  appName: string;
  primaryDomain: string;
  port: number;
  packageName: string;
  expiresAt: string | null;
  isActive: boolean;
  isSuspended: boolean;
}

async function loadCounts(): Promise<DashboardCounts> {
  const result = await getCoreDb().query<Record<string, string>>(`
    SELECT
      (SELECT COUNT(*) FROM public.apps WHERE is_active)::text            AS apps,
      (SELECT COUNT(*) FROM public.platform_users WHERE is_active)::text  AS users,
      (SELECT COUNT(*) FROM public.platforms)::text                       AS platforms,
      (SELECT COUNT(*) FROM public.platform_pages)::text                  AS pages,
      (SELECT COUNT(*) FROM public.platform_audit_logs)::text             AS audit_logs
  `);
  const row = result.rows[0] ?? {};
  return {
    apps: Number(row.apps ?? 0),
    users: Number(row.users ?? 0),
    platforms: Number(row.platforms ?? 0),
    pages: Number(row.pages ?? 0),
    auditLogs: Number(row.audit_logs ?? 0),
  };
}

/**
 * Sites with the commercial fields an agency administrator actually asks about
 * — which package they are on and when it lapses — rather than the internal
 * database name the previous table showed.
 */
async function loadSites(): Promise<SiteSummary[]> {
  const result = await getCoreDb().query<{
    id: string;
    app_slug: string;
    app_name: string;
    subdomain: string;
    port: number;
    package_name: string;
    package_expires_at: Date | null;
    is_active: boolean;
    is_suspended: boolean;
    primary_domain: string | null;
  }>(`
    SELECT a.id, a.app_slug, a.app_name, a.subdomain, a.port,
           a.package_name, a.package_expires_at, a.is_active, a.is_suspended,
           (SELECT d.domain FROM public.app_domains d
             WHERE d.app_id = a.id AND d.is_active
             ORDER BY d.is_primary DESC, d.domain LIMIT 1) AS primary_domain
    FROM public.apps a
    ORDER BY a.is_active DESC, a.app_name
  `);

  return result.rows.map((row) => ({
    appId: row.id,
    appSlug: row.app_slug,
    appName: row.app_name,
    primaryDomain: row.primary_domain ?? row.subdomain,
    port: row.port,
    packageName: row.package_name,
    expiresAt: row.package_expires_at ? row.package_expires_at.toISOString().slice(0, 10) : null,
    isActive: row.is_active,
    isSuspended: row.is_suspended,
  }));
}

const thaiDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(`${iso}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.round(hours / 24)} วันที่แล้ว`;
};

export default async function AdminDashboardPage() {
  const currentUser = await getCurrentUser();
  const isGod = currentUser?.globalRole === 'GOD';

  // Every figure below is read live from the control-plane database.
  const [counts, sites, audit] = await Promise.all([
    loadCounts().catch(() => ({ apps: 0, users: 0, platforms: 0, pages: 0, auditLogs: 0 })),
    loadSites().catch((): SiteSummary[] => []),
    fetchPlatformAudit({ limit: 6 }).catch(() => ({ logs: [], total: 0 })),
  ]);

  return (
    <div className="d-flex flex-column gap-3">
      <section className="adm-banner d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
        <div className="min-w-0">
          <p className="adm-banner-eyebrow mb-0">
            {isGod ? 'ผู้ดูแลระบบส่วนกลาง — บริษัท หนุมานไอที จำกัด' : 'ผู้ดูแลเว็บไซต์หน่วยงาน'}
          </p>
          <h2 className="adm-banner-title">
            สวัสดี {currentUser?.fullName || currentUser?.username}
          </h2>
          <p className="adm-banner-lead">
            {isGod
              ? 'ดูแลเว็บไซต์ของทุกหน่วยงานได้จากศูนย์กลางเดียว'
              : 'จัดการเนื้อหาและผู้ใช้ของเว็บไซต์หน่วยงานของคุณ'}
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2 flex-shrink-0">
          <Link href="/studio" className="adm-banner-btn">
            <Palette size={16} aria-hidden="true" /> ออกแบบหน้าเว็บ
          </Link>
          {isGod && (
            <Link href="/admin/apps" className="adm-banner-btn is-ghost">
              <Plus size={16} aria-hidden="true" /> เพิ่มเว็บไซต์
            </Link>
          )}
        </div>
      </section>

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            label="เว็บไซต์หน่วยงาน"
            value={counts.apps}
            unit="เว็บ"
            hint={isGod ? `แม่แบบระบบ ${counts.platforms} ชุด` : 'ที่เปิดใช้งานอยู่'}
            icon={Box}
            href="/admin/apps"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            label="ผู้ใช้งาน"
            value={counts.users}
            unit="บัญชี"
            hint="บัญชีที่เปิดใช้งานอยู่"
            icon={Users}
            href="/admin/users"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            label="หน้าเว็บที่ออกแบบไว้"
            value={counts.pages}
            unit="หน้า"
            hint="รวมทุกเว็บไซต์ในระบบ"
            icon={Layers}
            href="/studio"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            label="ประวัติการใช้งาน"
            value={counts.auditLogs}
            unit="รายการ"
            hint="บันทึกการเปลี่ยนแปลงทั้งหมด"
            icon={ScrollText}
            href="/audit-logs"
          />
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-7">
          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="adm-card-title">
                <Globe size={17} aria-hidden="true" /> เว็บไซต์ในระบบ
              </h2>
              <Link href="/admin/apps" className="adm-link">
                จัดการทั้งหมด <span aria-hidden="true">→</span>
              </Link>
            </div>

            {sites.length === 0 ? (
              <div className="adm-empty">
                <span className="adm-empty-icon">
                  <Inbox size={22} aria-hidden="true" />
                </span>
                <p className="adm-empty-title">ยังไม่มีเว็บไซต์ในระบบ</p>
                <p className="adm-empty-text">
                  {isGod ? (
                    <>
                      เริ่มต้นได้ที่หน้า <Link href="/admin/apps" className="adm-link">เว็บไซต์หน่วยงาน</Link>
                    </>
                  ) : (
                    'กรุณาติดต่อผู้ดูแลระบบส่วนกลางเพื่อเปิดใช้งานเว็บไซต์'
                  )}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th scope="col">ชื่อเว็บไซต์</th>
                      <th scope="col">ที่อยู่เว็บ</th>
                      <th scope="col">แพ็กเกจ</th>
                      <th scope="col">วันหมดอายุ</th>
                      <th scope="col" className="text-end">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => {
                      const remaining = site.expiresAt ? daysUntil(site.expiresAt) : null;
                      return (
                        <tr key={site.appId}>
                          <td>
                            <span className="adm-cell-strong d-block">{site.appName}</span>
                            <span className="adm-cell-sub">{site.appSlug}</span>
                          </td>
                          <td>
                            <code>{site.primaryDomain}</code>
                            <span className="adm-cell-sub d-block">พอร์ต {site.port}</span>
                          </td>
                          <td>{site.packageName}</td>
                          <td>
                            {site.expiresAt ? (
                              <>
                                <span className="d-block adm-nowrap">{thaiDate(site.expiresAt)}</span>
                                {remaining !== null && remaining <= 30 && (
                                  <span
                                    className={`adm-chip ${remaining < 0 ? 'is-danger' : 'is-warn'} mt-1`}
                                  >
                                    {remaining < 0
                                      ? `หมดอายุแล้ว ${Math.abs(remaining)} วัน`
                                      : `เหลือ ${remaining} วัน`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="adm-cell-sub">ไม่กำหนด</span>
                            )}
                          </td>
                          <td className="text-end">
                            {site.isSuspended ? (
                              <span className="adm-chip is-danger">ระงับการใช้งาน</span>
                            ) : site.isActive ? (
                              <span className="adm-chip is-ok">
                                <span className="adm-chip-dot" aria-hidden="true" /> เปิดใช้งาน
                              </span>
                            ) : (
                              <span className="adm-chip is-off">ปิดใช้งาน</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="col-12 col-xl-5">
          <section className="adm-card">
            <div className="adm-card-head">
              <h2 className="adm-card-title">
                <History size={17} aria-hidden="true" /> ความเคลื่อนไหวล่าสุด
              </h2>
              <Link href="/audit-logs" className="adm-link">
                ดูทั้งหมด <span aria-hidden="true">→</span>
              </Link>
            </div>

            {audit.logs.length === 0 ? (
              <div className="adm-empty">
                <span className="adm-empty-icon">
                  <History size={22} aria-hidden="true" />
                </span>
                <p className="adm-empty-title">ยังไม่มีความเคลื่อนไหว</p>
                <p className="adm-empty-text">รายการจะปรากฏเมื่อมีการใช้งานระบบ</p>
              </div>
            ) : (
              <ul className="adm-feed">
                {audit.logs.map((log) => (
                  <li key={log.id}>
                    <span className="adm-feed-mark" aria-hidden="true">
                      <History size={14} />
                    </span>
                    <span className="min-w-0 flex-grow-1">
                      <span className={`adm-chip ${auditActionTone(log.action)} float-end ms-2`}>
                        {auditActionLabel(log.action)}
                      </span>
                      <span className="adm-feed-text d-block">{log.changesSummary}</span>
                      <span className="adm-feed-meta">
                        {log.performedBy} · {relativeTime(log.createdAt)}
                        {log.platformName ? ` · ${log.platformName}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
