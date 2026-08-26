import type { GlobalRole, UserProfile } from '@/types';

export interface PlatformUserRow {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Columns selected by every platform-user query. */
export const PLATFORM_USER_COLUMNS = `
  id, username, email, full_name, avatar_url, global_role,
  is_active, must_change_password, last_login_at, created_at, updated_at
`;

export function toUser(row: PlatformUserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name ?? row.username,
    avatarUrl: row.avatar_url ?? undefined,
    globalRole: row.global_role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
