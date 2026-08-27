'use client';

import React from 'react';
import { ChevronRight, Eye, FileText } from 'lucide-react';

export interface NoticeItem {
  id?: string | number;
  name?: string;
  title?: string;
  publish_at?: string | null;
  created_at?: string | null;
  views?: number;
  url?: string | null;
  [key: string]: unknown;
}

export interface NoticeListComponentProps {
  title?: string;
  items?: NoticeItem[];
  moreHref?: string;
  moreLabel?: string;
  emptyText?: string;
  className?: string;
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/**
 * Announcements as a list rather than a card grid.
 *
 * Procurement notices are long, near-identical sentences: a grid of cards makes
 * them impossible to scan, while a dated list reads at a glance.
 */
export const NoticeListComponent: React.FC<NoticeListComponentProps> = ({
  title,
  items = [],
  moreHref,
  moreLabel = 'ดูทั้งหมด',
  emptyText = 'ยังไม่มีประกาศในขณะนี้',
  className = '',
}) => (
  <section className={`gov-notices ${className}`}>
    {(title || moreHref) && (
      <div className="gov-strip">
        {title && <h2 className="gov-strip-title">{title}</h2>}
        {moreHref && <a className="gov-strip-more" href={moreHref}>{moreLabel} <ChevronRight size={14} aria-hidden="true" /></a>}
      </div>
    )}

    {items.length === 0 ? (
      <p className="text-muted small mb-0">{emptyText}</p>
    ) : (
      <ul className="gov-notice-list">
        {items.map((item, index) => {
          const heading = item.name ?? item.title ?? '';
          const raw = item.publish_at ?? item.created_at;
          const date = raw ? new Date(raw) : null;
          const valid = date && !Number.isNaN(date.getTime());
          return (
            <li key={String(item.id ?? index)}>
              <a className="gov-notice" href={item.url ?? '#'}>
                <span className="gov-notice-date" aria-hidden="true">
                  {valid ? (
                    <>
                      <strong>{date.getDate()}</strong>
                      <small>{THAI_MONTHS[date.getMonth()]}</small>
                    </>
                  ) : (
                    <FileText size={18} />
                  )}
                </span>
                <span className="gov-notice-text">{heading}</span>
                {typeof item.views === 'number' && (
                  <span className="gov-notice-views">
                    <Eye size={12} aria-hidden="true" /> {item.views.toLocaleString('th-TH')}
                  </span>
                )}
                <ChevronRight size={16} className="gov-notice-caret" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
