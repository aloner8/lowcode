'use client';

import React, { useState } from 'react';
import UserTable from '@/components/admin/UserTable';
import UserFormModal from '@/components/admin/UserFormModal';
import AppMemberModal from '@/components/admin/AppMemberModal';
import { UserProfile, AppConfig, AppRole } from '@/types';
import { Users, UserPlus, Search, ShieldAlert, Sparkles } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([
    {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'admin',
      email: 'admin@platform.com',
      fullName: 'Super Admin',
      globalRole: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'aloner',
      email: 'aloner@platform.com',
      fullName: 'Aloner Developer',
      globalRole: 'DEVELOPER',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const mockApps: AppConfig[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      appSlug: 'demo-client-a',
      appName: 'Demo Client App A',
      port: 3001,
      subdomain: 'client-a.localhost',
      tenantDbName: 'app_db_client_a',
      themeConfig: {
        preset: 'corporate-emerald',
        mode: 'light',
        primaryColor: '#198754',
        borderRadius: '0.5rem',
        fontFamily: 'Inter, sans-serif',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNewUser = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setIsUserModalOpen(true);
  };

  const handleManageAppAccess = (user: UserProfile) => {
    setSelectedUser(user);
    setIsAppModalOpen(true);
  };

  const handleSaveUser = (userData: Partial<UserProfile> & { password?: string }) => {
    if (selectedUser) {
      // Edit existing user
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                ...userData,
                updatedAt: new Date().toISOString(),
              }
            : u
        )
      );
    } else {
      // Add new user
      const newUser: UserProfile = {
        id: `u-${Date.now()}`,
        username: userData.username || 'newuser',
        email: userData.email || 'user@platform.com',
        fullName: userData.fullName || 'New Platform Developer',
        globalRole: userData.globalRole || 'DEVELOPER',
        isActive: userData.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUsers((prev) => [...prev, newUser]);
    }
  };

  const handleSaveAccess = (userId: string, appPermissions: Record<string, AppRole | null>) => {
    alert(`บันทึกสิทธิ์การเข้าถึง App ใน Studio เรียบร้อยแล้วสำหรับ User ID: ${userId}`);
  };

  return (
    <div className="container-fluid p-0">
      {/* Header Bar */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-0.5 text-dark d-flex align-items-center gap-2 text-nowrap">
            <Users className="text-primary" size={20} />
            Platform Users & Roles
          </h4>
          <p className="text-secondary small mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
            Manage platform admins, developers (e.g. aloner), and Studio access rights
          </p>
        </div>

        <button
          onClick={handleCreateNewUser}
          className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 shadow-sm fw-medium text-nowrap"
          style={{ fontSize: '0.8rem' }}
        >
          <UserPlus size={16} />
          <span>+ Add New User</span>
        </button>
      </div>

      {/* Info Notice Banner */}
      <div className="alert alert-info border-0 bg-info bg-opacity-10 text-info-emphasis rounded-3 d-flex align-items-center gap-2 mb-3 p-2.5 small">
        <Sparkles size={16} className="text-info flex-shrink-0" />
        <div className="extra-small text-nowrap">
          <strong>Platform RBAC:</strong> <code>SUPER_ADMIN</code> (admin) has full platform access while <code>DEVELOPER</code> (aloner) is scoped to assigned Studio tenant apps.
        </div>
      </div>


      {/* Filter and Table Panel */}
      <div className="card border-0 shadow-sm rounded-3 bg-white mb-4">
        <div className="card-header bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
          <div className="input-group" style={{ maxWidth: '320px' }}>
            <span className="input-group-text bg-light border-end-0">
              <Search size={16} className="text-secondary" />
            </span>
            <input
              type="text"
              className="form-control bg-light border-start-0 small"
              placeholder="ค้นหาชื่อ, username หรือ อีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted extra-small">
            แสดง {filteredUsers.length} จาก {users.length} รายการ
          </div>
        </div>
        <div className="card-body p-0">
          <UserTable
            users={filteredUsers}
            onEditUser={handleEditUser}
            onManageAppAccess={handleManageAppAccess}
          />
        </div>
      </div>

      {/* User Add/Edit Modal */}
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        userToEdit={selectedUser}
      />

      {/* App Access Membership Modal */}
      <AppMemberModal
        isOpen={isAppModalOpen}
        onClose={() => setIsAppModalOpen(false)}
        user={selectedUser}
        apps={mockApps}
        onSaveAccess={handleSaveAccess}
      />
    </div>
  );
}
