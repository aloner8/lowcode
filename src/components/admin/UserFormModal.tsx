'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalRole } from '@/types';
import AdminModal from '@/components/admin/AdminModal';

interface UserFormModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (user: Partial<UserProfile> & { password?: string }) => void;
  readonly userToEdit?: UserProfile | null;
}

/**
 * Only two values exist in the schema, and the API rejects anything else. The
 * dropdown here used to offer DEVELOPER / SUPER_ADMIN / VIEWER, none of which
 * are accepted — so picking one failed the save, and leaving it alone showed a
 * role the form was not actually sending.
 */
const ROLE_OPTIONS: ReadonlyArray<{ value: GlobalRole; label: string; help: string }> = [
  {
    value: 'TENANT_USER',
    label: 'ผู้ใช้ของหน่วยงาน',
    help: 'เข้าถึงเฉพาะเว็บไซต์ที่ได้รับสิทธิ์ กำหนดสิทธิ์รายเว็บได้ที่ปุ่ม “สิทธิ์เว็บไซต์”',
  },
  {
    value: 'GOD',
    label: 'ผู้ดูแลระบบส่วนกลาง',
    help: 'พนักงานบริษัท หนุมานไอที จำกัด เข้าถึงทุกเว็บไซต์และตั้งค่าได้ทั้งระบบ',
  },
];

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
  const [globalRole, setGlobalRole] = useState<GlobalRole>('TENANT_USER');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setUsername(userToEdit?.username ?? '');
    setEmail(userToEdit?.email ?? '');
    setFullName(userToEdit?.fullName ?? '');
    setGlobalRole(userToEdit?.globalRole ?? 'TENANT_USER');
    setIsActive(userToEdit?.isActive ?? true);
    setPassword('');
  }, [userToEdit, isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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

  const roleHelp = ROLE_OPTIONS.find((option) => option.value === globalRole)?.help;

  return (
    <AdminModal
      isOpen={isOpen}
      title={userToEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้'}
      subtitle={
        userToEdit
          ? userToEdit.email
          : 'บัญชีนี้จะถูกบังคับให้ตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก'
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button type="button" className="adm-btn is-quiet" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="adm-btn">บันทึก</button>
        </>
      }
    >
      <div className="mb-3">
        <label htmlFor="uf-fullname" className="adm-label d-block">ชื่อ-นามสกุล</label>
        <input
          id="uf-fullname"
          className="adm-input"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="สมชาย ใจดี"
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="uf-username" className="adm-label d-block">ชื่อผู้ใช้</label>
        <input
          id="uf-username"
          className="adm-input is-mono"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="somchai"
          required
        />
        <p className="adm-help">ใช้สำหรับเข้าสู่ระบบ ร่วมกับอีเมล</p>
      </div>

      <div className="mb-3">
        <label htmlFor="uf-email" className="adm-label d-block">อีเมล</label>
        <input
          id="uf-email"
          type="email"
          className="adm-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="somchai@example.go.th"
          required
        />
      </div>

      {!userToEdit && (
        <div className="mb-3">
          <label htmlFor="uf-password" className="adm-label d-block">รหัสผ่านเริ่มต้น</label>
          <input
            id="uf-password"
            type="password"
            className="adm-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="อย่างน้อย 8 ตัวอักษร"
            minLength={8}
            required
          />
          <p className="adm-help">
            แจ้งรหัสนี้ให้ผู้ใช้ทราบ ระบบจะบังคับให้ตั้งรหัสใหม่ทันทีที่เข้าสู่ระบบครั้งแรก
          </p>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="uf-role" className="adm-label d-block">สิทธิ์ในระบบ</label>
        <select
          id="uf-role"
          className="adm-select"
          value={globalRole}
          onChange={(event) => setGlobalRole(event.target.value as GlobalRole)}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {roleHelp && <p className="adm-help">{roleHelp}</p>}
      </div>

      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          id="uf-active"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <label className="form-check-label adm-label mb-0" htmlFor="uf-active">
          เปิดใช้งานบัญชีนี้
        </label>
      </div>
      <p className="adm-help">ปิดไว้เพื่อระงับการเข้าใช้งานชั่วคราวโดยไม่ต้องลบบัญชี</p>
    </AdminModal>
  );
}
