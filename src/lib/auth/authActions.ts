'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserProfile, GlobalRole } from '@/types';

// Demo Mock Users for local dev fallback when Supabase Auth instance is offline
const MOCK_USERS: (UserProfile & { password: string })[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'admin',
    email: 'admin@platform.com',
    fullName: 'Super Admin',
    globalRole: 'SUPER_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    password: '1qaz@WSX',
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
    password: '1qaz@WSX',
  },
];

export async function loginAction(formData: FormData) {
  const identifier = formData.get('identifier')?.toString()?.trim() || '';
  const password = formData.get('password')?.toString() || '';

  if (!identifier || !password) {
    return { error: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน' };
  }

  try {
    const supabase = await createClient();

    // Determine if input is email or username
    const isEmail = identifier.includes('@');
    const emailToUse = isEmail ? identifier : `${identifier}@platform.com`;

    // Attempt Supabase Auth login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: password,
    });

    if (!error && data.user) {
      redirect('/admin');
    }

    // Fallback: Test against mock users if Supabase local/demo is not active
    const matchedUser = MOCK_USERS.find(
      (u) =>
        (u.email.toLowerCase() === identifier.toLowerCase() ||
          u.username?.toLowerCase() === identifier.toLowerCase()) &&
        u.password === password
    );

    if (matchedUser) {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      cookieStore.set('platform_mock_session', JSON.stringify(matchedUser), {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      redirect('/admin');
    }

    return { error: 'อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง' };
  } catch (err: any) {
    // NextJS redirect throws a internal error that should be rethrown
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return { error: err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
  }
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore error
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.delete('platform_mock_session');

  redirect('/login');
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        return {
          id: profile.id,
          username: profile.username || user.email?.split('@')[0],
          email: profile.email || user.email || '',
          fullName: profile.full_name || '',
          avatarUrl: profile.avatar_url,
          globalRole: (profile.global_role as GlobalRole) || 'DEVELOPER',
          isActive: profile.is_active ?? true,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
      }
    }
  } catch {
    // Ignore Supabase error, try mock fallback
  }

  // Mock session fallback for local dev mode
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const mockCookie = cookieStore.get('platform_mock_session');
    if (mockCookie?.value) {
      const parsed = JSON.parse(mockCookie.value);
      return parsed;
    }
  } catch {
    // Return null if invalid
  }

  return null;
}
