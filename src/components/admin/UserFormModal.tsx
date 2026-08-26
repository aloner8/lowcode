'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalRole } from '@/types';
import { UserPlus, Save } from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile> & { password?: string }) => void;
  userToEdit?: UserProfile | null;
}

export default function UserFormModal({
  isOpen,
  onClose,
  onSave,
  userToEdit,
}: UserFormModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [globalRole, setGlobalRole] = useState<GlobalRole>('DEVELOPER');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (userToEdit) {
      setUsername(userToEdit.username || '');
      setEmail(userToEdit.email || '');
      setFullName(userToEdit.fullName || '');
      setGlobalRole(userToEdit.globalRole || 'DEVELOPER');
      setIsActive(userToEdit.isActive ?? true);
      setPassword('');
    } else {
      setUsername('');
      setEmail('');
      setFullName('');
      setPassword('');
      setGlobalRole('DEVELOPER');
      setIsActive(true);
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: userToEdit?.id,
      username,
      email,
      fullName,
      globalRole,
      isActive,
      password: password || undefined,
    });
    onClose();
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-3">
          <div className="modal-header border-bottom px-4 py-3">
            <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              {userToEdit ? 'แก้ไขข้อมูลผู้ใช้งานเว็บแม่' : 'เพิ่มผู้ใช้งานระบบเว็บแม่ (Platform User)'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-3">
              <div className="mb-3">
                <label className="form-label small fw-medium text-secondary">Username (ชื่อผู้ใช้)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="เช่น aloner, dev_john"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium text-secondary">Email (อีเมล)</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="เช่น aloner@platform.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium text-secondary">ชื่อ - นามสกุล (Full Name)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="เช่น Aloner Developer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {!userToEdit && (
                <div className="mb-3">
                  <label className="form-label small fw-medium text-secondary">รหัสผ่าน (Password)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="ขั้นต่ำ 6 ตัวอักษร"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!userToEdit}
                  />
                  <div className="form-text extra-small text-muted">รหัสผ่านเริ่มต้นตั้งเป็น <code>1qaz@WSX</code></div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-medium text-secondary">Platform Global Role</label>
                <select
                  className="form-select"
                  value={globalRole}
                  onChange={(e) => setGlobalRole(e.target.value as GlobalRole)}
                >
                  <option value="DEVELOPER">🔵 DEVELOPER (สร้าง/แก้ไข Layout, Flow, Theme ใน Studio)</option>
                  <option value="SUPER_ADMIN">🔴 SUPER_ADMIN (สิทธิ์สูงสุด แอดมินควบคุมระบบ)</option>
                  <option value="VIEWER">⚪ VIEWER (สิทธิ์ดูได้อย่างเดียว)</option>
                </select>
              </div>

              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="userActiveSwitch"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label className="form-check-label small fw-medium" htmlFor="userActiveSwitch">
                  เปิดใช้งานบัญชีนี้ (Active User)
                </label>
              </div>
            </div>
            <div className="modal-footer border-top px-4 py-3">
              <button type="button" className="btn btn-light btn-sm" onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3">
                <Save size={16} />
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
