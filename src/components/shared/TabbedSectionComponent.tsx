'use client';

import React, { useId, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface TabItem {
  label: string;
  href?: string;
  description?: string;
  date?: string;
  external?: boolean;
}

export interface TabGroup {
  label: string;
  items?: TabItem[];
  emptyText?: string;
}

export interface TabbedSectionComponentProps {
  title?: string;
  subtitle?: string;
  tabs?: TabGroup[];
  className?: string;
}

/**
 * Groups of announcements behind tabs.
 *
 * Procurement notices come in kinds — invitations, reference prices, results —
 * that a visitor looks for one at a time. Every panel is in the HTML and only
 * hidden, so all of it is server-rendered and reachable by search, and the tab
 * strip follows the ARIA pattern: arrow keys move between tabs, Home and End
 * jump to the ends, and only the selected tab is in the tab order.
 */
export const TabbedSectionComponent: React.FC<TabbedSectionComponentProps> = ({
  title,
  subtitle,
  tabs = [],
  className = '',
}) => {
  const baseId = useId().replace(/:/g, '');
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  if (tabs.length === 0) return null;

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    focusTab(keys[event.key]);
  };

  return (
    <section className={`gov-tabs ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <h2 className="gov-section-title h4 fw-bold mb-1">{title}</h2>}
          {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
        </div>
      )}

      <div className="gov-tablist" role="tablist" aria-label={title ?? 'หมวดประกาศ'}>
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${index}`}
            aria-controls={`${baseId}-panel-${index}`}
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            className={`gov-tab ${index === active ? 'is-active' : ''}`}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
            {tab.items?.length ? <span className="gov-tab-count">{tab.items.length}</span> : null}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.label}
          role="tabpanel"
          id={`${baseId}-panel-${index}`}
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={index !== active}
          className="gov-tabpanel"
        >
          {(tab.items ?? []).length === 0 ? (
            <p className="text-muted small mb-0">{tab.emptyText ?? 'ยังไม่มีประกาศในหมวดนี้'}</p>
          ) : (
            <ul className="gov-tab-list">
              {tab.items?.map((item, itemIndex) => (
                <li key={`${item.label}-${itemIndex}`}>
                  <a
                    href={item.href ?? '#'}
                    {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    <span className="gov-tab-item-text">
                      <span className="gov-tab-item-label">{item.label}</span>
                      {item.description && <span className="gov-tab-item-note">{item.description}</span>}
                    </span>
                    {item.date && <span className="gov-tab-item-date">{item.date}</span>}
                    <ChevronRight size={16} aria-hidden="true" />
                    {item.external && <span className="visually-hidden">(เปิดในแท็บใหม่)</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
};
