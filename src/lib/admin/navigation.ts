import {
  LayoutDashboard,
  Layers,
  Users,
  Box,
  ShieldCheck,
  ScrollText,
  Palette,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { GlobalRole } from '@/types';

/**
 * The admin console menu.
 *
 * One definition drives both the sidebar and the topbar heading, so a renamed
 * screen cannot end up with two different names. Labels are Thai because the
 * operators are Thai government staff; only terms with no settled Thai
 * equivalent (Studio, SEO, log) stay in English.
 */
export interface AdminNavItem {
  readonly href: string;
  readonly label: string;
  /** Shown under the heading — says what the screen is for, in plain words. */
  readonly description: string;
  readonly icon: LucideIcon;
  readonly tag?: string;
  /** Restricted to หนุมานไอที staff; mirrors GOD_ONLY_PREFIXES in proxy.ts. */
  readonly godOnly?: boolean;
  /** Opens a separate tool rather than another console screen. */
  readonly external?: boolean;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: '/admin',
    label: 'ภาพรวม',
    description: 'สรุปสถานะเว็บไซต์และการใช้งานล่าสุด',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/apps',
    label: 'เว็บไซต์หน่วยงาน',
    description: 'สร้างและตั้งค่าเว็บไซต์ ธีม โดเมน และ SEO',
    icon: Box,
  },
  {
    href: '/admin/users',
    label: 'ผู้ใช้และสิทธิ์',
    description: 'เพิ่มผู้ใช้ กำหนดสิทธิ์ และรีเซ็ตรหัสผ่าน',
    icon: Users,
  },
  {
    href: '/admin/platforms',
    label: 'แม่แบบระบบ',
    description: 'โครงสร้างตั้งต้นที่ใช้สร้างเว็บไซต์ใหม่',
    icon: Layers,
    tag: 'GOD',
    godOnly: true,
  },
  {
    href: '/admin/security',
    label: 'ความปลอดภัย',
    description: 'จำกัดอัตราการเรียก และปลดล็อกบัญชีที่ถูกล็อก',
    icon: ShieldCheck,
    tag: 'GOD',
    godOnly: true,
  },
  {
    href: '/audit-logs',
    label: 'ประวัติการใช้งาน',
    description: 'บันทึกทุกการเปลี่ยนแปลงที่เกิดขึ้นในระบบ',
    icon: ScrollText,
  },
];

export const ADMIN_TOOLS: readonly AdminNavItem[] = [
  {
    href: '/studio',
    label: 'ออกแบบหน้าเว็บ',
    description: 'จัดวางหน้าเว็บด้วย DesignStudio',
    icon: Palette,
    external: true,
  },
  {
    href: '/flow-studio',
    label: 'ออกแบบขั้นตอนงาน',
    description: 'ผูกลำดับงานด้วย Flow Studio',
    icon: Workflow,
    external: true,
    godOnly: true,
  },
];

/** Hides what the role cannot open, so nobody is sent to a 403. */
export function visibleNav(items: readonly AdminNavItem[], role: GlobalRole): AdminNavItem[] {
  return items.filter((item) => !item.godOnly || role === 'GOD');
}

/**
 * The entry matching a pathname.
 *
 * Longest prefix wins so `/admin/apps/123` still resolves to เว็บไซต์หน่วยงาน
 * rather than falling back to the `/admin` overview.
 */
export function navItemFor(pathname: string): AdminNavItem | undefined {
  const all = [...ADMIN_NAV, ...ADMIN_TOOLS];
  const exact = all.find((item) => item.href === pathname);
  if (exact) return exact;

  return all
    .filter((item) => item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
