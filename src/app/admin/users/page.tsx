'use client';

import React, { useCallback, useEffect, useState } from 'react';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import AppMemberModal from '@/components/admin/AppMemberModal';
import { UserProfile, PlatformConfig, AppRole } from '@/types';
import { Users, UserPlus, Search, ShieldAlert, RefreshCw } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [memberships, setMemberships] = useState<Record<string, AppRole>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isAccessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersResponse, platformsResponse] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/platforms', { cache: 'no-store' }),
      ]);
      const usersPayload = await usersResponse.json();
      if (!usersResponse.ok) throw new Error(usersPayload.error || 'ไม่สามารถอ่านรายชื่อผู้ใช้ได้');
      setUsers(usersPayload.users as UserProfile[]);

      const platformsPayload = await platformsResponse.json();
      if (platformsResponse.ok) setPlatforms(platformsPayload.platforms as PlatformConfig[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveUser = async (payload: Partial<UserProfile> & { password?: string }) => {
    setSaving(true);
    setError('');
    try {
      const isEdit = Boolean(payload.id);
      const response = await fetch(isEdit ? `/api/users/${payload.id}` : '/api/users', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกผู้ใช้ไม่สำเร็จ');
      setUserModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกผู้ใช้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAccess = async (user: UserProfile) => {
    setSelectedUser(user);
    setMemberships({});
    setAccessModalOpen(true);
    try {
      const response = await fetch(`/api/users/${user.id}/memberships`, { cache: 'no-store' });
      const payload = await response.json();
      if (response.ok) {
        const map: Record<string, AppRole> = {};
        for (const row of payload.memberships as Array<{ platformId: string; platformRole: AppRole }>) {
          map[row.platformId] = row.platformRole;
        }
        setMemberships(map);
      }
    } catch {
      // Modal still opens; grants simply start empty.
    }
  };

  const handleSaveAccess = async (userId: string, permissions: Record<string, AppRole | null>) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/memberships`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberships: permissions }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'บันทึกสิทธิ์ไม่สำเร็จ');
      setAccessModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกสิทธิ์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const needle = searchTerm.toLowerCase();
    return (
      (user.username ?? '').toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle) ||
      (user.fullName ?? '').toLowerCase().includes(needle)
    );
  });

  const pendingPasswordCount = users.filter((user) => user.mustChangePassword).length;

  return (
    <div className="container-fluid p-0">
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <Users className="text-primary" size={24} /> ผู้ใช้และสิทธิ์ (Users &amp; Roles)
          </h4>
          <p className="text-secondary small mb-0">
            บัญชีทั้งหมดถูกเก็บใน <code>public.platform_users</code> และตรวจรหัสผ่านด้วย pgcrypto
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={`me-1 ${loading ? 'spin' : ''}`} /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm fw-semibold"
            onClick={() => { setSelectedUser(null); setUserModalOpen(true); }}
          >
            <UserPlus size={15} className="me-1" /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger border-0 rounded-3 small">{error}</div>}

      {pendingPasswordCount > 0 && (
        <div className="alert alert-warning border-0 rounded-3 small d-flex align-items-center gap-2">
          <ShieldAlert size={16} />
          มีผู้ใช้ {pendingPasswordCount} คนที่ยังไม่ได้เปลี่ยนรหัสผ่านเริ่มต้น
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-3 mb-3">
        <div className="card-body p-3">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0"><Search size={16} className="text-secondary" /></span>
            <input
              className="form-control border-start-0"
              placeholder="ค้นหาจากชื่อผู้ใช้ อีเมล หรือชื่อ-นามสกุล"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="ค้นหาผู้ใช้"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" /> กำลังโหลด…
        </div>
      ) : (
        <UserTable
          users={filteredUsers}
          onEditUser={(user) => { setSelectedUser(user); setUserModalOpen(true); }}
          onManageAppAccess={(user) => void handleOpenAccess(user)}
        />
      )}

      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSave={(payload) => void handleSaveUser(payload)}
        userToEdit={selectedUser}
      />

      <AppMemberModal
        isOpen={isAccessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        user={selectedUser}
        platforms={platforms}
        initialRoles={memberships}
        isSaving={saving}
        onSaveAccess={(userId, permissions) => void handleSaveAccess(userId, permissions)}
      />
    </div>
  );
}
