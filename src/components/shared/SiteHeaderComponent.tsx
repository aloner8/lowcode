'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Landmark, Menu, X } from 'lucide-react';

export interface SiteNavItem {
  label: string;
  href?: string;
  active?: boolean;
  children?: SiteNavItem[];
}

export interface SiteHeaderComponentProps {
  agencyName?: string;
  agencyNameEn?: string;
  slogan?: string;
  /** Official emblem. Left as a neutral mark when absent — never invented. */
  emblemUrl?: string | null;
  homeHref?: string;
  items?: SiteNavItem[];
  className?: string;
}

/**
 * Agency identity plus the main menu.
 *
 * The emblem is only ever an uploaded file: a government seal must not be
 * generated or substituted, so with none configured this renders a neutral
 * placeholder mark rather than something that could pass for a real crest.
 *
 * Submenus open on click, not hover — hover menus are unusable on touch and
 * unreachable from a keyboard.
 */
export const SiteHeaderComponent: React.FC<SiteHeaderComponentProps> = ({
  agencyName = 'ชื่อหน่วยงาน',
  agencyNameEn,
  slogan,
  emblemUrl = null,
  homeHref = '/',
  items = [],
  className = '',
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!openMenu && !drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenMenu(null);
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu, drawerOpen]);

  const renderItem = (item: SiteNavItem, index: number, inDrawer: boolean) => {
    const key = `${item.label}-${index}`;
    const hasChildren = Boolean(item.children?.length);

    if (!hasChildren) {
      return (
        <li key={key}>
          <a
            href={item.href ?? '#'}
            className={`gov-nav-link ${item.active ? 'is-active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            onClick={() => setDrawerOpen(false)}
          >
            {item.label}
          </a>
        </li>
      );
    }

    const open = openMenu === key;
    return (
      <li key={key} className="gov-nav-item">
        <button
          type="button"
          className={`gov-nav-link ${item.active ? 'is-active' : ''}`}
          aria-expanded={open}
          onClick={() => setOpenMenu(open ? null : key)}
        >
          {item.label}
          <ChevronDown size={14} aria-hidden="true" className={open ? 'gov-nav-caret is-open' : 'gov-nav-caret'} />
        </button>
        {open && (
          <ul className={inDrawer ? 'gov-nav-sublist' : 'gov-nav-dropdown'}>
            {item.children?.map((child, childIndex) => (
              <li key={`${child.label}-${childIndex}`}>
                <a
                  href={child.href ?? '#'}
                  className="gov-nav-sublink"
                  onClick={() => { setOpenMenu(null); setDrawerOpen(false); }}
                >
                  {child.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <header className={`gov-header ${className}`}>
      <div className="gov-header-identity">
        <a href={homeHref} className="gov-header-brand">
          {emblemUrl ? (
            // Uploaded by the agency; an arbitrary URL, so next/image cannot optimise it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblemUrl} alt={`ตราสัญลักษณ์${agencyName}`} className="gov-emblem" width={64} height={64} />
          ) : (
            <span className="gov-emblem gov-emblem-placeholder" aria-hidden="true">
              <Landmark size={30} />
            </span>
          )}
          <span className="gov-header-names">
            <span className="gov-agency-name">{agencyName}</span>
            {agencyNameEn && <span className="gov-agency-name-en">{agencyNameEn}</span>}
            {slogan && <span className="gov-agency-slogan">{slogan}</span>}
          </span>
        </a>

        <button
          type="button"
          className="gov-nav-toggle"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="gov-main-nav"
          aria-label="เปิดเมนู"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      <nav className="gov-nav d-none d-lg-block" aria-label="เมนูหลัก">
        <ul className="gov-nav-list">{items.map((item, index) => renderItem(item, index, false))}</ul>
      </nav>

      {drawerOpen && (
        <>
          <button type="button" className="gov-nav-backdrop" aria-label="ปิดเมนู" onClick={() => setDrawerOpen(false)} />
          <nav id="gov-main-nav" className="gov-nav-drawer" aria-label="เมนูหลัก">
            <div className="gov-nav-drawer-head">
              <span className="fw-bold">เมนู</span>
              <button type="button" className="gov-nav-close" onClick={() => setDrawerOpen(false)} aria-label="ปิดเมนู">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ul className="gov-nav-drawer-list">{items.map((item, index) => renderItem(item, index, true))}</ul>
          </nav>
        </>
      )}
    </header>
  );
};
