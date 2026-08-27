'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, RefreshCw, ShieldAlert, AlertCircle, Users } from 'lucide-react';
import { ROLE_LABELS, type SiteRole } from '@/types';

interface SiteMember {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  siteRole: SiteRole;
  grantedAt: string;
}

interface SiteUserManagerProps {
  readonly appId: string;
  readonly currentUserId: string;
  readonly maxUsers: number | null;
}

const ROLE_OPTIONS: SiteRole[] = ['ADMIN', 'STAFF', 'VIEWER'];

/** ผู้ดูแลระบบของหน่วยงานเพิ่ม/ถอดผู้ใช้ และกำหนดสิทธิ์ภายใน Site ของตัวเอง */
export default function SiteUserManager({ appId, currentUserId, maxUsers }: SiteUserManagerProps) {
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [siteRole, setSiteRole] = useState<SiteRole>('STAFF');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/apps/${appId}/users`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถอ่านรายชื่อผู้ใช้ได้');
      setMembers(payload.users as SiteMember[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านรายชื่อผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/apps/${appId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, password, siteRole }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'เพิ่มผู้ใช้ไม่สำเร็จ');
      setMembers(payload.users as SiteMember[]);
      setEmail(''); setFullName(''); setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มผู้ใช้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, role: SiteRole) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${appId}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, siteRole: role }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ปรับสิทธิ์ไม่สำเร็จ');
      setMembers(payload.users as SiteMember[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ปรับสิทธิ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: SiteMember) => {
    if (!window.confirm(`ถอด ${member.email} ออกจากหน่วยงานนี้ใช่หรือไม่?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/apps/${appId}/users?userId=${member.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ถอดผู้ใช้ไม่สำเร็จ');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ถอดผู้ใช้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const seatsFull = maxUsers !== null && members.length >= maxUsers;

  return (
    <div className="row g-3 align-items-start">
      <div className="col-12 col-lg-5">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="adm-card-title">
              <UserPlus size={17} aria-hidden="true" /> เพิ่มผู้ใช้
            </h2>
          </div>
          <form className="p-3" onSubmit={submit}>
            {seatsFull && (
              <div className="adm-alert is-warn mb-3">
                <ShieldAlert size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />
                <span>ใช้สิทธิ์ครบ {maxUsers} คนแล้ว หากต้องการเพิ่มโควตา กรุณาติดต่อผู้ให้บริการ</span>
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="memberEmail" className="adm-label d-block">อีเมล</label>
              <input
                id="memberEmail" type="email" className="adm-input" value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="somchai@example.go.th" required
              />
              <p className="adm-help">ถ้ามีบัญชีอยู่แล้วจะเพิ่มเข้าหน่วยงานนี้ทันที</p>
            </div>

            <div className="mb-3">
              <label htmlFor="memberName" className="adm-label d-block">ชื่อ-นามสกุล</label>
              <input
                id="memberName" className="adm-input" value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="สมชาย ใจดี"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="memberPassword" className="adm-label d-block">รหัสผ่านเริ่มต้น</label>
              <input
                id="memberPassword" type="password" className="adm-input" value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร" minLength={8}
              />
              <p className="adm-help">
                กรอกเฉพาะเมื่อเป็นผู้ใช้ใหม่ — ระบบจะบังคับให้ตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งแรก
              </p>
            </div>

            <div className="mb-3">
              <label htmlFor="memberRole" className="adm-label d-block">สิทธิ์</label>
              <select
                id="memberRole" className="adm-select" value={siteRole}
                onChange={(event) => setSiteRole(event.target.value as SiteRole)}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="adm-btn w-100" disabled={busy || seatsFull}>
              {busy ? 'กำลังบันทึก…' : 'เพิ่มผู้ใช้'}
            </button>
          </form>
        </section>
      </div>

      <div className="col-12 col-lg-7">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2 className="adm-card-title">
              ผู้ใช้ในหน่วยงาน ({members.length}{maxUsers ? ` / ${maxUsers}` : ''})
            </h2>
            <button
              type="button" className="adm-btn is-quiet is-sm"
              onClick={() => void load()} disabled={loading} aria-label="โหลดรายชื่อใหม่"
            >
              <RefreshCw size={14} className={loading ? 'adm-spin' : ''} aria-hidden="true" />
            </button>
          </div>

          {error && (
            <div className="p-3 pb-0">
              <div className="adm-alert is-danger" role="alert">
                <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {members.length === 0 ? (
            <div className="adm-empty">
              <span className="adm-empty-icon"><Users size={22} aria-hidden="true" /></span>
              <p className="adm-empty-title">ยังไม่มีผู้ใช้ในหน่วยงาน</p>
              <p className="adm-empty-text">ใช้แบบฟอร์มด้านซ้ายเพื่อเพิ่มคนแรก</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">ผู้ใช้</th>
                    <th scope="col" style={{ width: '32%' }}>สิทธิ์</th>
                    <th scope="col" className="text-end">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.id === currentUserId;
                    return (
                      <tr key={member.id}>
                        <td>
                          <span className="adm-cell-strong d-block">
                            {member.fullName || member.username}
                            {isSelf && <span className="adm-chip is-info ms-2">คุณ</span>}
                          </span>
                          <span className="adm-cell-sub d-block">{member.email}</span>
                          {member.mustChangePassword && (
                            <span className="adm-chip is-warn mt-1">ยังไม่เปลี่ยนรหัสผ่าน</span>
                          )}
                        </td>
                        <td>
                          <select
                            className="adm-select"
                            value={member.siteRole}
                            disabled={busy || isSelf}
                            onChange={(event) => void changeRole(member.id, event.target.value as SiteRole)}
                            aria-label={`สิทธิ์ของ ${member.email}`}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="adm-btn is-danger is-sm"
                            disabled={busy || isSelf}
                            onClick={() => void remove(member)}
                            title={isSelf ? 'ถอดตัวเองออกไม่ได้' : `ถอด ${member.email} ออกจากหน่วยงาน`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                            <span className="d-none d-xl-inline">ถอดออก</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
