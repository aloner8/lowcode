'use client';

import React, { useCallback, useEffect, useState } from 'react';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import AppMemberModal from '@/components/admin/AppMemberModal';
import { UserProfile, PlatformConfig, SiteRole } from '@/types';
import { UserPlus, Search, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [memberships, setMemberships] = useState<Record<string, SiteRole>>({});

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
        const map: Record<string, SiteRole> = {};
        for (const row of payload.memberships as Array<{ platformId: string; platformRole: SiteRole }>) {
          map[row.platformId] = row.platformRole;
        }
        setMemberships(map);
      }
    } catch {
      // Modal still opens; grants simply start empty.
    }
  };

  const handleSaveAccess = async (userId: string, permissions: Record<string, SiteRole | null>) => {
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
    <div className="d-flex flex-column gap-3">
      <div className="adm-toolbar">
        <p className="adm-toolbar-note">
          เพิ่มผู้ใช้ กำหนดว่าใครเข้าถึงเว็บไซต์ใดได้บ้าง และดูว่าใครยังไม่เปลี่ยนรหัสผ่านเริ่มต้น
        </p>
        <div className="d-flex gap-2">
          <button type="button" className="adm-btn is-quiet is-sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'adm-spin' : ''} aria-hidden="true" /> โหลดใหม่
          </button>
          <button
            type="button"
            className="adm-btn is-sm"
            onClick={() => { setSelectedUser(null); setUserModalOpen(true); }}
          >
            <UserPlus size={15} aria-hidden="true" /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-alert is-danger" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {pendingPasswordCount > 0 && (
        <div className="adm-alert is-warn">
          <ShieldAlert size={17} className="flex-shrink-0 mt-1" aria-hidden="true" />
          <span>
            มีผู้ใช้ {pendingPasswordCount} คนที่ยังใช้รหัสผ่านที่ระบบตั้งให้
            บัญชีเหล่านี้จะถูกบังคับให้ตั้งรหัสผ่านใหม่ก่อนใช้งานส่วนอื่น
          </span>
        </div>
      )}

      <div className="adm-card p-3">
        <label htmlFor="user-search" className="adm-label d-block">ค้นหาผู้ใช้</label>
        <div className="auth-field">
          <Search size={17} className="auth-field-icon" aria-hidden="true" />
          <input
            id="user-search"
            className="adm-input"
            style={{ paddingInlineStart: '2.5rem' }}
            placeholder="ชื่อผู้ใช้ อีเมล หรือชื่อ-นามสกุล"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <p className="adm-help" aria-live="polite">
          แสดง {filteredUsers.length} จากทั้งหมด {users.length} บัญชี
        </p>
      </div>

      {loading ? (
        <div className="adm-card adm-empty">
          <RefreshCw size={22} className="adm-spin mb-2" aria-hidden="true" />
          <p className="adm-empty-text">กำลังโหลด…</p>
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
