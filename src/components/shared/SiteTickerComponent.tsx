'use client';

import React from 'react';
import { Megaphone } from 'lucide-react';

export interface TickerItem {
  label: string;
  href?: string;
}

export interface SiteTickerComponentProps {
  label?: string;
  items?: TickerItem[];
  className?: string;
}

/**
 * The scrolling strip of latest announcements under the banner.
 *
 * Movement pauses on hover and on keyboard focus, and stops entirely when the
 * visitor has asked for reduced motion — text that slides away before it can be
 * read is unusable, and the CSS honours that rather than the component guessing.
 */
export const SiteTickerComponent: React.FC<SiteTickerComponentProps> = ({
  label = 'ข่าวสารและกิจกรรมล่าสุด',
  items = [],
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <div className={`gov-ticker ${className}`}>
      <span className="gov-ticker-label">
        <Megaphone size={14} aria-hidden="true" /> {label}
      </span>
      <div className="gov-ticker-viewport">
        <ul className="gov-ticker-track">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
            </li>
          ))}
          {/* A second copy so the strip loops without a visible seam. */}
          {items.map((item, index) => (
            <li key={`dup-${item.label}-${index}`} aria-hidden="true">
              {item.href ? <a href={item.href} tabIndex={-1}>{item.label}</a> : <span>{item.label}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
