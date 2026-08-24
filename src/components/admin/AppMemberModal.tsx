'use client';

import React, { useState } from 'react';
import { UserProfile, AppConfig, AppRole } from '@/types';
import { Shield, Box, Check, Save } from 'lucide-react';

interface AppMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  apps: AppConfig[];
  onSaveAccess: (userId: string, appPermissions: Record<string, AppRole | null>) => void;
}

export default function AppMemberModal({
  isOpen,
  onClose,
  user,
  apps,
  onSaveAccess,
}: AppMemberModalProps) {
  const [permissions, setPermissions] = useState<Record<string, AppRole | null>>({
    'a0000000-0000-0000-0000-000000000001': 'APP_OWNER',
  });

  if (!isOpen || !user) return null;

  const handleRoleChange = (appId: string, role: AppRole | null) => {
    setPermissions((prev) => ({
      ...prev,
      [appId]: role,
    }));
  };

  const handleSave = () => {
    onSaveAccess(user.id, permissions);
    onClose();
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-3">
          <div className="modal-header border-bottom px-4 py-3">
            <div>
              <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2 mb-1">
                <Shield size={18} className="text-info" />
                จัดการสิทธิ์การเข้าถึง App ใน Studio สำหรับ: {user.fullName || user.username}
              </h5>
              <div className="text-muted extra-small">
                กำหนดว่า Developer คนนี้มีสิทธิ์สลับไปแก้ไข Layout/Flow ของ App ลูกตัวใดบ้าง
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body px-4 py-3">
            <div className="table-responsive rounded-3 border">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="py-2.5 px-3 small fw-semibold">App ลูก (Child Tenant App)</th>
                    <th className="py-2.5 px-3 small fw-semibold">Subdomain / Port</th>
                    <th className="py-2.5 px-3 small fw-semibold text-end">สิทธิ์ใน Studio (App Role)</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => {
                    const currentRole = permissions[app.id] ?? null;
                    return (
                      <tr key={app.id}>
                        <td className="py-2.5 px-3">
                          <div className="d-flex align-items-center gap-2">
                            <Box size={18} className="text-primary" />
                            <div>
                              <div className="fw-semibold small">{app.appName}</div>
                              <div className="text-muted extra-small">{app.appSlug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 extra-small text-secondary">
                          <code>{app.subdomain}</code> (:{app.port})
                        </td>
                        <td className="py-2.5 px-3 text-end">
                          <select
                            className="form-select form-select-sm d-inline-block w-auto"
                            value={currentRole || ''}
                            onChange={(e) =>
                              handleRoleChange(app.id, (e.target.value as AppRole) || null)
                            }
                          >
                            <option value="">❌ ไม่มีสิทธิ์ (No Access)</option>
                            <option value="APP_OWNER">👑 APP_OWNER (เจ้าของ App)</option>
                            <option value="APP_EDITOR">✍️ APP_EDITOR (แก้ไข Layout/Flow)</option>
                            <option value="APP_VIEWER">👁️ APP_VIEWER (ดูได้อย่างเดียว)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer border-top px-4 py-3">
            <button type="button" className="btn btn-light btn-sm" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="button" onClick={handleSave} className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3">
              <Save size={16} />
              บันทึกสิทธิ์ App Memberships
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
