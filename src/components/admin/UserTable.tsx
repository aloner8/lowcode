'use client';

import React from 'react';
import { KeyRound, Pencil, SearchX, ShieldCheck, User as UserIcon } from 'lucide-react';
import { UserProfile } from '@/types';

interface UserTableProps {
  readonly users: UserProfile[];
  readonly onEditUser?: (user: UserProfile) => void;
  readonly onManageAppAccess?: (user: UserProfile) => void;
}

const ROLE_LABELS: Record<string, string> = {
  GOD: 'ผู้ดูแลระบบส่วนกลาง',
  TENANT_USER: 'ผู้ใช้ของหน่วยงาน',
};

const lastSeen = (iso?: string) => {
  if (!iso) return 'ยังไม่เคยเข้าใช้งาน';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'เข้าใช้งานวันนี้';
  if (days === 1) return 'เข้าใช้งานเมื่อวาน';
  return `เข้าใช้งานล่าสุด ${days} วันก่อน`;
};

export default function UserTable({ users, onEditUser, onManageAppAccess }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="adm-card adm-empty">
        <span className="adm-empty-icon"><SearchX size={22} aria-hidden="true" /></span>
        <p className="adm-empty-title">ไม่พบผู้ใช้ที่ตรงกับคำค้น</p>
        <p className="adm-empty-text">ลองใช้คำอื่น หรือล้างช่องค้นหาเพื่อดูทั้งหมด</p>
      </div>
    );
  }

  return (
    <div className="adm-card">
      <div className="table-responsive">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">ผู้ใช้งาน</th>
              <th scope="col">สิทธิ์</th>
              <th scope="col">สถานะ</th>
              <th scope="col" className="text-end">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <span className="d-flex align-items-center gap-2">
                    <span className="adm-avatar" aria-hidden="true">
                      {(user.username ?? user.email)[0]?.toUpperCase() ?? 'U'}
                    </span>
                    <span className="min-w-0">
                      <span className="adm-cell-strong d-block">{user.fullName || user.username}</span>
                      <span className="adm-cell-sub d-block">
                        {user.email}
                        {user.username ? ` · ${user.username}` : ''}
                      </span>
                    </span>
                  </span>
                </td>

                <td>
                  <span className={`adm-chip ${user.globalRole === 'GOD' ? 'is-warn' : 'is-info'}`}>
                    {user.globalRole === 'GOD' ? (
                      <ShieldCheck size={12} aria-hidden="true" />
                    ) : (
                      <UserIcon size={12} aria-hidden="true" />
                    )}
                    {ROLE_LABELS[user.globalRole] ?? user.globalRole}
                  </span>
                </td>

                <td>
                  <span className="d-flex flex-column gap-1 align-items-start">
                    {user.isActive ? (
                      <span className="adm-chip is-ok">
                        <span className="adm-chip-dot" aria-hidden="true" /> ใช้งานได้
                      </span>
                    ) : (
                      <span className="adm-chip is-off">ระงับการใช้งาน</span>
                    )}
                    {user.mustChangePassword && (
                      <span className="adm-chip is-warn">ยังไม่เปลี่ยนรหัสผ่าน</span>
                    )}
                    <span className="adm-cell-sub">{lastSeen(user.lastLoginAt)}</span>
                  </span>
                </td>

                <td className="text-end">
                  <span className="d-inline-flex gap-1">
                    <button
                      type="button"
                      className="adm-btn is-quiet is-sm"
                      onClick={() => onManageAppAccess?.(user)}
                      title={`กำหนดสิทธิ์เข้าถึงเว็บไซต์ของ ${user.fullName || user.username}`}
                    >
                      <KeyRound size={13} aria-hidden="true" />
                      <span className="d-none d-lg-inline">สิทธิ์เว็บไซต์</span>
                    </button>
                    <button
                      type="button"
                      className="adm-btn is-quiet is-sm"
                      onClick={() => onEditUser?.(user)}
                      title={`แก้ไขข้อมูลของ ${user.fullName || user.username}`}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      <span className="d-none d-lg-inline">แก้ไข</span>
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
