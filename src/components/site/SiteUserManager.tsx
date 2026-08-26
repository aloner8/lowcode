'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';
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
    <div className="row g-3">
      <div className="col-12 col-lg-5">
        <section className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white border-bottom py-3 px-4">
            <h2 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
              <UserPlus size={18} className="text-primary" /> เพิ่มผู้ใช้
            </h2>
          </div>
          <form className="card-body p-4" onSubmit={submit}>
            {seatsFull && (
              <div className="alert alert-warning border-0 small rounded-3 d-flex align-items-center gap-2">
                <ShieldAlert size={15} /> ใช้สิทธิ์ครบ {maxUsers} คนแล้ว
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="memberEmail" className="form-label small fw-semibold">อีเมล</label>
              <input id="memberEmail" type="email" className="form-control" value={email}
                     onChange={(event) => setEmail(event.target.value)} required />
              <div className="form-text">ถ้ามีบัญชีอยู่แล้วจะเพิ่มเข้าหน่วยงานนี้ทันที</div>
            </div>

            <div className="mb-3">
              <label htmlFor="memberName" className="form-label small fw-semibold">ชื่อ-นามสกุล</label>
              <input id="memberName" className="form-control" value={fullName}
                     onChange={(event) => setFullName(event.target.value)} />
            </div>

            <div className="mb-3">
              <label htmlFor="memberPassword" className="form-label small fw-semibold">
                รหัสผ่านเริ่มต้น (เฉพาะผู้ใช้ใหม่)
              </label>
              <input id="memberPassword" type="password" className="form-control" value={password}
                     onChange={(event) => setPassword(event.target.value)} minLength={8} />
            </div>

            <div className="mb-3">
              <label htmlFor="memberRole" className="form-label small fw-semibold">สิทธิ์</label>
              <select id="memberRole" className="form-select" value={siteRole}
                      onChange={(event) => setSiteRole(event.target.value as SiteRole)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role} — {ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={busy || seatsFull}>
              {busy ? 'กำลังบันทึก…' : 'เพิ่มผู้ใช้'}
            </button>
          </form>
        </section>
      </div>

      <div className="col-12 col-lg-7">
        <section className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
            <h2 className="h6 fw-bold mb-0">
              ผู้ใช้ในหน่วยงาน ({members.length}{maxUsers ? ` / ${maxUsers}` : ''})
            </h2>
            <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="card-body p-0">
            {error && <div className="alert alert-danger border-0 rounded-0 mb-0 small">{error}</div>}
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="small ps-4">ผู้ใช้</th>
                    <th className="small" style={{ width: '30%' }}>สิทธิ์</th>
                    <th className="small text-end pe-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-muted py-4 small">ยังไม่มีผู้ใช้</td></tr>
                  )}
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="ps-4">
                        <div className="fw-semibold small text-dark">{member.fullName || member.username}</div>
                        <div className="extra-small text-secondary">{member.email}</div>
                        {member.mustChangePassword && (
                          <span className="badge bg-warning bg-opacity-25 text-warning-emphasis extra-small mt-1">
                            ยังไม่เปลี่ยนรหัสผ่าน
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={member.siteRole}
                          disabled={busy || member.id === currentUserId}
                          onChange={(event) => void changeRole(member.id, event.target.value as SiteRole)}
                          aria-label={`สิทธิ์ของ ${member.email}`}
                        >
                          {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={busy || member.id === currentUserId}
                          onClick={() => void remove(member)}
                          aria-label={`ถอด ${member.email}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
