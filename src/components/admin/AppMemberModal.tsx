'use client';

import React, { useEffect, useState } from 'react';
import { UserProfile, PlatformConfig, AppRole } from '@/types';
import { Shield, Layers, Save } from 'lucide-react';

interface PlatformMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  platforms: PlatformConfig[];
  /** Current grants, keyed by platform id. */
  initialRoles: Record<string, AppRole>;
  onSaveAccess: (userId: string, permissions: Record<string, AppRole | null>) => void;
  isSaving?: boolean;
}

const ROLE_OPTIONS: Array<{ value: AppRole | ''; label: string }> = [
  { value: '', label: 'ไม่มีสิทธิ์' },
  { value: 'APP_VIEWER', label: 'APP_VIEWER — อ่านอย่างเดียว' },
  { value: 'APP_EDITOR', label: 'APP_EDITOR — แก้ไข Studio ได้' },
  { value: 'APP_OWNER', label: 'APP_OWNER — Publish และ Build Runtime ได้' },
];

/**
 * Grants a developer access to specific Platform Masters.
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
  const [permissions, setPermissions] = useState<Record<string, AppRole | null>>({});

  useEffect(() => {
    if (isOpen) setPermissions({ ...initialRoles });
  }, [isOpen, initialRoles]);

  if (!isOpen || !user) return null;

  const handleRoleChange = (platformId: string, role: AppRole | '') => {
    setPermissions((prev) => ({ ...prev, [platformId]: role === '' ? null : role }));
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1050 }}
      role="dialog"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow rounded-3">
          <div className="modal-header">
            <h6 className="modal-title fw-bold d-flex align-items-center gap-2">
              <Shield size={18} className="text-primary" />
              สิทธิ์เข้าถึง Platform — {user.fullName || user.username}
            </h6>
            <button type="button" className="btn-close" onClick={onClose} aria-label="ปิด" />
          </div>

          <div className="modal-body">
            {user.globalRole === 'SUPER_ADMIN' && (
              <div className="alert alert-info border-0 small rounded-3">
                ผู้ใช้นี้เป็น SUPER_ADMIN จึงเข้าถึงทุก Platform อยู่แล้ว โดยไม่ต้องกำหนดสิทธิ์รายรายการ
              </div>
            )}

            {platforms.length === 0 ? (
              <p className="text-muted small mb-0">ยังไม่มี Platform ในระบบ</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="small">Platform</th>
                      <th className="small" style={{ width: '45%' }}>สิทธิ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.map((platform) => (
                      <tr key={platform.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Layers size={15} className="text-secondary" />
                            <div>
                              <div className="fw-semibold small text-dark">{platform.platformName}</div>
                              <code className="extra-small text-secondary">{platform.platformSlug}</code>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={permissions[platform.id] ?? ''}
                            onChange={(event) => handleRoleChange(platform.id, event.target.value as AppRole | '')}
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
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose}>ยกเลิก</button>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2"
              disabled={isSaving}
              onClick={() => onSaveAccess(user.id, permissions)}
            >
              <Save size={16} /> {isSaving ? 'กำลังบันทึก…' : 'บันทึกสิทธิ์'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
