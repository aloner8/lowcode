'use client';

import React, { useEffect, useState } from 'react';
import { Info, Layers } from 'lucide-react';
import { UserProfile, PlatformConfig, SiteRole, ROLE_LABELS } from '@/types';
import AdminModal from '@/components/admin/AdminModal';

interface PlatformMemberModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly user: UserProfile | null;
  readonly platforms: PlatformConfig[];
  /** Current grants, keyed by platform id. */
  readonly initialRoles: Record<string, SiteRole>;
  readonly onSaveAccess: (userId: string, permissions: Record<string, SiteRole | null>) => void;
  readonly isSaving?: boolean;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: SiteRole | ''; label: string }> = [
  { value: '', label: 'ไม่มีสิทธิ์' },
  { value: 'VIEWER', label: `ดูอย่างเดียว — ${ROLE_LABELS.VIEWER}` },
  { value: 'STAFF', label: `เจ้าหน้าที่ — ${ROLE_LABELS.STAFF}` },
  { value: 'ADMIN', label: `ผู้ดูแลเว็บไซต์ — ${ROLE_LABELS.ADMIN}` },
];

/**
 * Grants a user access to specific sites.
 * These rows are what `requirePlatformAccess` checks on every scoped API call.
 */
export default function AppMemberModal({
  isOpen,
  onClose,
  user,
  platforms,
  initialRoles,
  onSaveAccess,
  isSaving = false,
}: PlatformMemberModalProps) {
  const [permissions, setPermissions] = useState<Record<string, SiteRole | null>>({});

  useEffect(() => {
    if (isOpen) setPermissions({ ...initialRoles });
  }, [isOpen, initialRoles]);

  if (!user) return null;

  const handleRoleChange = (platformId: string, role: SiteRole | '') => {
    setPermissions((prev) => ({ ...prev, [platformId]: role === '' ? null : role }));
  };

  return (
    <AdminModal
      isOpen={isOpen}
      wide
      title="สิทธิ์เข้าถึงเว็บไซต์"
      subtitle={user.fullName || user.username}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="adm-btn is-quiet" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="adm-btn"
            disabled={isSaving}
            onClick={() => onSaveAccess(user.id, permissions)}
          >
            {isSaving ? 'กำลังบันทึก…' : 'บันทึกสิทธิ์'}
          </button>
        </>
      }
    >
      {user.globalRole === 'GOD' && (
        <div className="adm-alert is-info mb-3">
          <Info size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>
            บัญชีนี้เป็นผู้ดูแลระบบส่วนกลาง จึงเข้าถึงทุกเว็บไซต์อยู่แล้ว
            สิทธิ์ที่ตั้งที่นี่จะไม่จำกัดการเข้าถึงของบัญชีนี้
          </span>
        </div>
      )}

      {platforms.length === 0 ? (
        <p className="adm-empty-text mb-0">ยังไม่มีแม่แบบระบบให้กำหนดสิทธิ์</p>
      ) : (
        <div className="table-responsive">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">แม่แบบระบบ</th>
                <th scope="col" style={{ width: '48%' }}>สิทธิ์</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((platform) => (
                <tr key={platform.id}>
                  <td>
                    <span className="d-flex align-items-center gap-2">
                      <Layers size={15} style={{ color: 'var(--gov-muted-soft)' }} aria-hidden="true" />
                      <span>
                        <span className="adm-cell-strong d-block">{platform.platformName}</span>
                        <span className="adm-cell-sub font-monospace">{platform.platformSlug}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <select
                      className="adm-select"
                      value={permissions[platform.id] ?? ''}
                      onChange={(event) => handleRoleChange(platform.id, event.target.value as SiteRole | '')}
                      aria-label={`สิทธิ์บน ${platform.platformName}`}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminModal>
  );
}
