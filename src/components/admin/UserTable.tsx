'use client';

import React from 'react';
import { UserProfile } from '@/types';
import { ShieldCheck, Code, Eye, Edit3, Lock, CheckCircle, XCircle } from 'lucide-react';

interface UserTableProps {
  users: UserProfile[];
  onEditUser?: (user: UserProfile) => void;
  onManageAppAccess?: (user: UserProfile) => void;
}

export default function UserTable({ users, onEditUser, onManageAppAccess }: UserTableProps) {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'GOD':
        return (
          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1">
            <ShieldCheck size={13} /> GOD
          </span>
        );
      case 'TENANT_USER':
        return (
          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1">
            <Code size={13} /> TENANT_USER
          </span>
        );
      default:
        return (
          <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2.5 py-1 rounded-2 d-inline-flex align-items-center gap-1">
            <Eye size={13} /> VIEWER
          </span>
        );
    }
  };

  return (
    <div className="table-responsive rounded-3 border bg-white shadow-sm">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th className="py-3 px-3 small fw-semibold text-secondary">ผู้ใช้งาน (User)</th>
            <th className="py-3 px-3 small fw-semibold text-secondary">Global Role</th>
            <th className="py-3 px-3 small fw-semibold text-secondary text-center">สถานะ (Status)</th>
            <th className="py-3 px-3 small fw-semibold text-secondary text-end">การจัดการ (Actions)</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="py-3 px-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: u.globalRole === 'GOD' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    }}
                  >
                    {u.username ? u.username[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="fw-semibold text-dark mb-0.5">{u.fullName || u.username}</div>
                    <div className="text-muted extra-small">{u.email} {u.username && `(@${u.username})`}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-3">{getRoleBadge(u.globalRole)}</td>
              <td className="py-3 px-3 text-center">
                {u.isActive ? (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 rounded-2 d-inline-flex align-items-center gap-1">
                    <CheckCircle size={12} /> Active
                  </span>
                ) : (
                  <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1 rounded-2 d-inline-flex align-items-center gap-1">
                    <XCircle size={12} /> Suspended
                  </span>
                )}
              </td>
              <td className="py-3 px-3 text-end">
                <div className="d-inline-flex gap-1.5">
                  <button
                    onClick={() => onManageAppAccess && onManageAppAccess(u)}
                    className="btn btn-sm btn-outline-info d-flex align-items-center gap-1 px-2.5 py-1 rounded-2"
                    title="กำหนดสิทธิ์เข้าถึง App ใน Studio"
                  >
                    <Lock size={13} />
                    <span className="small">App Access</span>
                  </button>
                  <button
                    onClick={() => onEditUser && onEditUser(u)}
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-2.5 py-1 rounded-2"
                    title="แก้ไขข้อมูลผู้ใช้"
                  >
                    <Edit3 size={13} />
                    <span className="small">Edit</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
