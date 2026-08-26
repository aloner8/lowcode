'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProfile } from '@/types';
import {
  LayoutDashboard,
  Layers,
  Users,
  Box,
  Shield,
  FileText,
  Palette,
  Workflow,
  LogOut,
  Sparkles,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/authActions';

interface AdminSidebarProps {
  user: UserProfile;
}

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Platforms', href: '/admin/platforms', icon: Layers, badge: 'Blueprint' },
    { label: 'Users & Roles', href: '/admin/users', icon: Users, badge: 'Platform' },
    { label: 'Tenant Apps & Sites', href: '/admin/apps', icon: Box },
    { label: 'Security & RLS', href: '/admin/security', icon: Shield },
    { label: 'Audit Logs', href: '/audit-logs', icon: FileText },
  ];

  const studioItems = [
    { label: 'DesignStudio', href: '/studio', icon: Palette },
    { label: 'Flow Studio', href: '/flow-studio', icon: Workflow },
  ];

  return (
    <aside
      className="d-flex flex-column justify-content-between p-2.5 border-end bg-dark text-white select-none"
      style={{
        width: isCollapsed ? '64px' : '240px',
        minWidth: isCollapsed ? '64px' : '240px',
        minHeight: '100vh',
        background: '#0f172a',
        borderRight: '1px solid rgba(255, 255, 255, 0.08) !important',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div>
        {/* Brand Header & Toggle Button */}
        <div className="d-flex align-items-center justify-content-between mb-3 px-1 pt-1 overflow-hidden">
          <Link href="/admin" className="d-flex align-items-center gap-2 text-decoration-none text-white overflow-hidden">
            <div
              className="d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              }}
            >
              <Sparkles size={18} />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden text-nowrap">
                <div className="fw-bold lh-1" style={{ fontSize: '0.9rem' }}>Platform Admin</div>
                <span className="text-white-50 extra-small" style={{ fontSize: '0.68rem' }}>
                  Control Studio
                </span>
              </div>
            )}
          </Link>

          <button
            className="btn btn-sm btn-outline-secondary border-0 text-white-50 hover-text-white p-1 rounded-2"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* User Card */}
        <div
          className={`mb-3 rounded-3 border ${isCollapsed ? 'p-1 text-center' : 'p-2.5'}`}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
          title={isCollapsed ? `${user.fullName || user.username} (${user.globalRole})` : undefined}
        >
          <div className={`d-flex align-items-center gap-2 ${isCollapsed ? 'justify-content-center' : 'mb-1'}`}>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              style={{
                width: '28px',
                height: '28px',
                background: user.globalRole === 'GOD' ? '#ef4444' : '#3b82f6',
                fontSize: '0.78rem',
              }}
            >
              {user.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="fw-medium text-truncate" style={{ fontSize: '0.8rem' }}>
                  {user.fullName || user.username}
                </div>
                <div className="text-white-50 text-truncate" style={{ fontSize: '0.68rem' }}>
                  {user.email}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="mt-1">
              <span
                className={`badge extra-small ${
                  user.globalRole === 'GOD'
                    ? 'bg-danger text-white'
                    : 'bg-primary text-white'
                }`}
                style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem' }}
              >
                {user.globalRole}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        {!isCollapsed && (
          <div className="text-white-50 fw-semibold text-uppercase px-1 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.06em' }}>
            SYSTEM CONTROL
          </div>
        )}
        <ul className="nav nav-pills flex-column gap-1 mb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link d-flex align-items-center ${isCollapsed ? 'justify-content-center px-0' : 'justify-content-between px-2.5'} py-1.5 rounded-2 text-nowrap ${
                    isActive ? 'bg-primary text-white fw-medium shadow-sm' : 'text-white-50 hover-light'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                    background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : undefined,
                  }}
                >
                  <div className="d-flex align-items-center gap-2 text-nowrap">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-white-50'} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className="badge bg-secondary bg-opacity-50 text-white ms-1" style={{ fontSize: '0.58rem', padding: '0.15rem 0.35rem' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!isCollapsed && (
          <div className="text-white-50 fw-semibold text-uppercase px-1 mb-1.5" style={{ fontSize: '0.65rem', letterSpacing: '0.06em' }}>
            STUDIO TOOLS
          </div>
        )}
        <ul className="nav nav-pills flex-column gap-1">
          {studioItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link d-flex align-items-center ${isCollapsed ? 'justify-content-center px-0' : 'justify-content-between px-2.5'} py-1.5 rounded-2 text-nowrap ${
                    isActive ? 'bg-primary text-white fw-medium shadow-sm' : 'text-white-50 hover-light'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                    background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : undefined,
                  }}
                >
                  <div className="d-flex align-items-center gap-2 text-nowrap">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-info'} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && <ExternalLink size={12} className={isActive ? 'text-white' : 'text-white-50'} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer Sign Out */}
      <div className="pt-2 border-top border-secondary border-opacity-25">
        <form action={logoutAction}>
          <button
            type="submit"
            className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-1.5 py-1.5 rounded-2 text-nowrap"
            style={{ fontSize: '0.78rem' }}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut size={14} /> {!isCollapsed && <span>Logout</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
