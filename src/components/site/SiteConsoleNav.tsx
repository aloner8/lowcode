'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
};

export interface SiteNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: keyof typeof ICONS;
}

/**
 * Tabs for one agency's console.
 *
 * Client-side only because the active tab depends on the pathname — the server
 * layout rendered these as plain links with no current-page marker at all.
 */
export default function SiteConsoleNav({ items }: { readonly items: readonly SiteNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหน่วยงาน">
      <ul className="adm-tabs">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`adm-tab ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={15} aria-hidden="true" /> {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
