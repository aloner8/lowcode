import {
  LayoutDashboard,
  Layers,
  Users,
  Box,
  ShieldCheck,
  ScrollText,
  Palette,
  ChevronRight,
  Shapes,
  PackageOpen,
  Home,
  Gauge,
  PanelsTopLeft,
  ShieldEllipsis,
  Network,
  CalendarDays,
  ClipboardList,
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
  /** Nested design tools shown below their parent group. */
  readonly children?: readonly AdminNavItem[];
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
    label: 'เว็บไซต์ของฉัน',
    description: 'ดู App ที่กำลังทดสอบและเว็บไซต์ที่ใช้งานจริงของคุณ',
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
    href: '/page-designer/public-home',
    label: 'ออกแบบหน้าเว็บ',
    description: 'จัดวางหน้าเว็บด้วย DesignStudio',
    icon: Palette,
    children: [
      { href: '/page-designer/public-home', label: '1. Public Home', description: 'ออกแบบหน้าแรกสาธารณะ', icon: Home },
      { href: '/page-designer/dashboard', label: '2. Dashboard', description: 'ออกแบบหน้าสรุปข้อมูลและตัวชี้วัด', icon: Gauge },
      { href: '/page-designer/master-detail', label: '3. Form Master Detail', description: 'ออกแบบฟอร์มข้อมูลหลักและรายการย่อย', icon: PanelsTopLeft },
      { href: '/page-designer/admin-page', label: '4. Admin Page', description: 'ออกแบบหน้าจัดการระบบหลังบ้าน', icon: ShieldEllipsis },
      { href: '/page-designer/diagram', label: '5. Diagram', description: 'ออกแบบหน้าแผนภาพและความสัมพันธ์', icon: Network },
      { href: '/page-designer/calendar', label: '6. Calendar', description: 'ออกแบบหน้าปฏิทินและตารางนัดหมาย', icon: CalendarDays },
    ],
  },
  {
    href: '/form-designer',
    label: 'ออกแบบฟอร์มข้อมูล',
    description: 'สร้างแม่แบบ FormComponent, Collection Set และสัญญา Req/Response',
    icon: ClipboardList,
  },
  {
    href: '/svg-studio',
    label: 'SVG Studio',
    description: 'สร้าง Visual Object แบบกำหนดพารามิเตอร์และนำกลับมาใช้ซ้ำ',
    icon: Shapes,
    godOnly: true,
    children: [
      ['background', '1. ออกแบบพื้นหลัง'],
      ['button', '2. ออกแบบปุ่ม'],
      ['card', '3. ออกแบบการ์ด + Animation'],
      ['icon', '4. ออกแบบ ICON'],
      ['art-text', '5. ข้อความศิลป์'],
      ['frame', '6. กรอบรูป'],
      ['auto-form', '7. Form Auto Draw with Field'],
    ].map(([slug, label]) => ({
      href: `/svg-studio/${slug}`,
      label,
      description: `สร้างแม่แบบ ${label.replace(/^\d+\.\s*/, '')}`,
      icon: ChevronRight,
      godOnly: true,
    })),
  },
  {
    href: '/module-studio',
    label: 'ออกแบบ Module',
    description: 'รวม Page, API, Flow และ Object ที่สัมพันธ์กันเป็นแม่แบบเดียว',
    icon: PackageOpen,
  },
];

/** Hides what the role cannot open, so nobody is sent to a 403. */
export function visibleNav(items: readonly AdminNavItem[], role: GlobalRole): AdminNavItem[] {
  return items
    .filter((item) => !item.godOnly || role === 'GOD')
    .map((item) => ({ ...item, children: item.children ? visibleNav(item.children, role) : undefined }));
}

/**
 * The entry matching a pathname.
 *
 * Longest prefix wins so `/admin/apps/123` still resolves to เว็บไซต์ของฉัน
 * rather than falling back to the `/admin` overview.
 */
export function navItemFor(pathname: string): AdminNavItem | undefined {
  const flatten = (items: readonly AdminNavItem[]): AdminNavItem[] =>
    items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
  const all = flatten([...ADMIN_NAV, ...ADMIN_TOOLS]);
  const exact = all.find((item) => item.href === pathname);
  if (exact) return exact;

  return all
    .filter((item) => item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
