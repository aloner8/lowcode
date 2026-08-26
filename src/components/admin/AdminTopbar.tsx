'use client';

import React from 'react';
import { UserProfile } from '@/types';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AdminTopbarProps {
  user: UserProfile;
}

export default function AdminTopbar({ user }: AdminTopbarProps) {
  return (
    <header
      className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom bg-white shadow-sm"
      style={{ minHeight: '64px', zIndex: 10 }}
    >
      <div className="d-flex align-items-center gap-3">
        <span className="fw-semibold text-dark small text-nowrap">
          Platform Control Admin
        </span>
        <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 px-2 py-0.5 text-nowrap" style={{ fontSize: '0.7rem' }}>
          🟢 Core DB Online
        </span>
      </div>

      <div className="d-flex align-items-center gap-3">
        <Link
          href="/studio"
          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5 rounded-2 text-nowrap"
          style={{ fontSize: '0.8rem' }}
        >
          <span>DesignStudio</span>
          <ExternalLink size={13} />
        </Link>


        <div className="vr my-1 bg-secondary opacity-25"></div>

        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
            style={{
              width: '36px',
              height: '36px',
              background: user.globalRole === 'GOD' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            }}
          >
            {user.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <div className="d-none d-md-block text-end">
            <div className="fw-medium text-dark small lh-1">{user.fullName || user.username}</div>
            <div className="text-muted extra-small" style={{ fontSize: '0.7rem' }}>
              {user.globalRole === 'GOD' ? '🔴 Super Admin' : '🔵 Platform Developer'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
