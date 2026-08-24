import React from 'react';
import StatWidgetCard from '@/components/admin/StatWidgetCard';
import { getCurrentUser } from '@/lib/auth/authActions';
import { Box, Users, Activity, Layers, Palette, Workflow, Plus, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const currentUser = await getCurrentUser();

  const mockApps = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      appName: 'Demo Client App A',
      appSlug: 'demo-client-a',
      port: 3001,
      subdomain: 'client-a.localhost',
      tenantDbName: 'app_db_client_a',
      themePreset: 'corporate-emerald',
      status: 'Running',
    },
  ];

  const recentLogs = [
    { id: 1, action: 'UPDATE_THEME', user: 'aloner', app: 'Demo Client App A', time: '10m ago', desc: 'Theme updated to Corporate Emerald' },
    { id: 2, action: 'CREATE_APP', user: 'admin', app: 'Demo Client App A', time: '2h ago', desc: 'Provisioned new tenant app on port 3001' },
  ];

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
            value={mockApps.length}
            subtitle="Active port :3001"
            icon={Box}
            color="primary"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Platform Users"
            value="2 Users"
            subtitle="1 Super Admin, 1 Developer"
            icon={Users}
            color="purple"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Dynamic Page Layouts"
            value="1 Page"
            subtitle="JSON AST Dashboard"
            icon={Layers}
            color="info"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatWidgetCard
            title="Audit Trail Logs"
            value="24 Logs"
            subtitle="Recent system actions"
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
                    {mockApps.map((app) => (
                      <tr key={app.id}>
                        <td className="py-2.5 px-3.5">
                          <div className="fw-semibold text-dark small text-nowrap">{app.appName}</div>
                          <div className="text-muted extra-small text-nowrap">{app.appSlug}</div>
                        </td>
                        <td className="py-2.5 px-3 extra-small text-nowrap">
                          <code>{app.subdomain}</code> (:{app.port})
                        </td>
                        <td className="py-2.5 px-3 extra-small text-secondary text-nowrap">
                          <code>{app.tenantDbName}</code>
                        </td>
                        <td className="py-2.5 px-3 text-end text-nowrap">
                          <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 px-2 py-0.5" style={{ fontSize: '0.7rem' }}>
                            🟢 {app.status}
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
                        <span className="fw-semibold extra-small text-dark text-nowrap">@{log.user}</span>
                        <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small" style={{ fontSize: '0.62rem' }}>
                          {log.action}
                        </span>
                        <span className="text-muted extra-small ms-auto" style={{ fontSize: '0.68rem' }}>{log.time}</span>
                      </div>
                      <div className="extra-small text-secondary mt-0.5 text-nowrap">{log.desc}</div>
                      <div className="extra-small text-muted mt-0.5 text-nowrap" style={{ fontSize: '0.68rem' }}>App: {log.app}</div>
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

