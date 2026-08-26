import React from 'react';
import StatWidgetCard from '@/components/admin/StatWidgetCard';
import { getCurrentUser } from '@/lib/auth/authActions';
import { getCoreDb } from '@/lib/db/coreDb';
import { fetchPlatformAudit } from '@/lib/engine/AuditLogService';
import { listSites, type SiteRecord } from '@/lib/runtime/siteRegistry';
import { Box, Users, Activity, Layers, Palette, Workflow, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface DashboardCounts {
  apps: number;
  users: number;
  platforms: number;
  pages: number;
  auditLogs: number;
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

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export default async function AdminDashboardPage() {
  const currentUser = await getCurrentUser();

  // Every figure below is read live from the control-plane database.
  const [counts, sites, audit] = await Promise.all([
    loadCounts().catch(() => ({ apps: 0, users: 0, platforms: 0, pages: 0, auditLogs: 0 })),
    listSites(true).catch((): SiteRecord[] => []),
    fetchPlatformAudit({ limit: 8 }).catch(() => ({ logs: [], total: 0 })),
  ]);
  const recentLogs = audit.logs;

  return (
    <div className="container-fluid p-0">
      {/* Welcome Banner */}
      <div
        className="card border-0 text-white rounded-3 shadow-sm mb-3 p-3.5"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #31104b 50%, #4c1d95 100%)',
        }}
      >
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <div className="badge bg-white bg-opacity-20 text-white mb-1.5 px-2.5 py-0.5 rounded-pill text-nowrap" style={{ fontSize: '0.7rem' }}>
              Control Studio Overview
            </div>
            <h4 className="fw-bold mb-0.5 text-nowrap">
              Welcome, {currentUser?.fullName || currentUser?.username} ({currentUser?.globalRole})
            </h4>
            <p className="text-white-50 small mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
              Low-Code Multi-Tenant Platform Mother Control Center
            </p>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/studio"
              className="btn btn-light btn-sm fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm text-nowrap"
              style={{ fontSize: '0.8rem' }}
            >
              <Palette size={15} className="text-primary" />
              <span>DesignStudio</span>
            </Link>
            <Link
              href="/flow-studio"
              className="btn btn-outline-light btn-sm fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-nowrap"
              style={{ fontSize: '0.8rem' }}
            >
              <Workflow size={15} className="text-info" />
              <span>Flow Studio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Total Tenant Apps"
            value={counts.apps}
            subtitle={`${counts.platforms} Platform Master`}
            icon={Box}
            color="primary"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Platform Users"
            value={`${counts.users} Users`}
            subtitle="บัญชีที่เปิดใช้งานอยู่"
            icon={Users}
            color="purple"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Dynamic Page Layouts"
            value={`${counts.pages} Pages`}
            subtitle="JSON AST ทั้งหมดใน Platform"
            icon={Layers}
            color="info"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Audit Trail Logs"
            value={`${counts.auditLogs} Logs`}
            subtitle="ประวัติการเปลี่ยนแปลงทั้งหมด"
            icon={Activity}
            color="success"
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="row g-3">
        {/* Apps List Panel */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
            <div className="card-header bg-white border-bottom py-2.5 px-3.5 d-flex align-items-center justify-content-between">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2 small text-nowrap">
                <Box size={16} className="text-primary" />
                Tenant Child Apps
              </h6>
              <Link href="/admin/apps" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 text-nowrap py-1 px-2.5" style={{ fontSize: '0.78rem' }}>
                <span>Manage All</span>
                <ArrowRight size={13} />
              </Link>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="py-2 px-3.5 extra-small text-nowrap">App Name</th>
                      <th className="py-2 px-3 extra-small text-nowrap">Subdomain / Port</th>
                      <th className="py-2 px-3 extra-small text-nowrap">Tenant DB</th>
                      <th className="py-2 px-3 extra-small text-end text-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted small py-4">
                          ยังไม่มี Tenant App — สร้างได้ที่หน้า Tenant Apps
                        </td>
                      </tr>
                    )}
                    {sites.map((site) => (
                      <tr key={site.appId}>
                        <td className="py-2.5 px-3.5">
                          <div className="fw-semibold text-dark small text-nowrap">{site.appName}</div>
                          <div className="text-muted extra-small text-nowrap">{site.appSlug}</div>
                        </td>
                        <td className="py-2.5 px-3 extra-small text-nowrap">
                          <code>{site.domains[0] ?? site.subdomain}</code> (:{site.port})
                        </td>
                        <td className="py-2.5 px-3 extra-small text-secondary text-nowrap">
                          <code>{site.tenantDbName}</code>
                        </td>
                        <td className="py-2.5 px-3 text-end text-nowrap">
                          <span className={`badge px-2 py-0.5 ${site.isActive
                            ? 'bg-success bg-opacity-15 text-success border border-success border-opacity-25'
                            : 'bg-secondary bg-opacity-15 text-secondary border border-secondary border-opacity-25'}`}
                            style={{ fontSize: '0.7rem' }}>
                            {site.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 bg-white h-100">
            <div className="card-header bg-white border-bottom py-2.5 px-3.5">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2 small text-nowrap">
                <Activity size={16} className="text-info" />
                Recent Audit Trail Feed
              </h6>
            </div>
            <div className="card-body p-3.5">
              <div className="d-flex flex-column gap-2.5">
                {recentLogs.length === 0 && (
                  <p className="text-muted small mb-0">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
                )}
                {recentLogs.map((log) => (
                  <div key={log.id} className="d-flex align-items-start gap-2.5 pb-2.5 border-bottom border-light">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary bg-primary bg-opacity-10 mt-0.5 flex-shrink-0"
                      style={{ width: '28px', height: '28px' }}
                    >
                      <Activity size={14} />
                    </div>
                    <div className="overflow-hidden w-100">
                      <div className="d-flex align-items-center justify-content-between gap-1">
                        <span className="fw-semibold extra-small text-dark text-nowrap">@{log.performedBy}</span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small" style={{ fontSize: '0.62rem' }}>
                          {log.action}
                        </span>
                        <span className="text-muted extra-small ms-auto" style={{ fontSize: '0.68rem' }}>{relativeTime(log.createdAt)}</span>
                      </div>
                      <div className="extra-small text-secondary mt-0.5">{log.changesSummary}</div>
                      {log.platformName && (
                        <div className="extra-small text-muted mt-0.5 text-nowrap" style={{ fontSize: '0.68rem' }}>Platform: {log.platformName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

