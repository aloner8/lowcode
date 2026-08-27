'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SidebarMenuItem {
  label: string;
  href?: string;
  active?: boolean;
  children?: SidebarMenuItem[];
}

export interface SiteSidebarMenuComponentProps {
  title?: string;
  items?: SidebarMenuItem[];
  className?: string;
  /**
   * The page content this menu sits beside. Nodes nested under this one in the
   * page tree arrive here, which is how the two-column layout is expressed
   * without a separate grid component.
   */
  children?: React.ReactNode;
}

/** A branch is open when it is the active one, so the current page is visible. */
const containsActive = (item: SidebarMenuItem): boolean =>
  Boolean(item.active) || (item.children ?? []).some(containsActive);

/**
 * The category menu down the side of a Thai government site.
 *
 * A branch that holds the current page starts open, and branches use buttons
 * rather than `href="#"` links so a keyboard reaches them and a screen reader
 * announces them as what they are.
 */
export const SiteSidebarMenuComponent: React.FC<SiteSidebarMenuComponentProps> = ({
  title = 'หมวดหมู่',
  items = [],
  className = '',
  children,
}) => {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item, index) => [`${item.label}-${index}`, containsActive(item)])));

  const toggle = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));

  const menu = (
    <nav className={`gov-sidebar ${className}`} aria-label="เมนูหมวดหมู่">
      <p className="gov-sidebar-title">{title}</p>

      {items.length === 0 ? (
        <p className="text-muted small mb-0 px-2">ยังไม่ได้กำหนดเมนู</p>
      ) : (
        <ul className="gov-sidebar-list">
          {items.map((item, index) => {
            const key = `${item.label}-${index}`;
            const hasChildren = Boolean(item.children?.length);
            const expanded = open[key] ?? false;

            if (!hasChildren) {
              return (
                <li key={key}>
                  <a
                    href={item.href ?? '#'}
                    className={`gov-sidebar-link ${item.active ? 'is-active' : ''}`}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              );
            }

            return (
              <li key={key}>
                <button
                  type="button"
                  className={`gov-sidebar-link ${containsActive(item) ? 'is-active' : ''}`}
                  aria-expanded={expanded}
                  onClick={() => toggle(key)}
                >
                  <span className="flex-grow-1 text-start">{item.label}</span>
                  {expanded
                    ? <ChevronDown size={15} aria-hidden="true" />
                    : <ChevronRight size={15} aria-hidden="true" />}
                </button>

                {expanded && (
                  <ul className="gov-sidebar-sublist">
                    {item.children?.map((child, childIndex) => (
                      <li key={`${child.label}-${childIndex}`}>
                        <a
                          href={child.href ?? '#'}
                          className={`gov-sidebar-sublink ${child.active ? 'is-active' : ''}`}
                          aria-current={child.active ? 'page' : undefined}
                        >
                          {child.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );

  // Without nested content the menu is simply a block on its own.
  if (!children) return menu;

  return (
    <div className="gov-with-sidebar">
      {menu}
      <div className="gov-with-sidebar-main">{children}</div>
    </div>
  );
};
