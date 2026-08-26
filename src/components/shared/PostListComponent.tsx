'use client';

import React from 'react';
import { CalendarDays, ArrowRight } from 'lucide-react';

export interface PostItem {
  id?: string | number;
  name?: string;
  title?: string;
  description?: string;
  image?: string | null;
  publish_at?: string | null;
  created_at?: string | null;
  category?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

export interface PostListComponentProps {
  title?: string;
  subtitle?: string;
  items?: PostItem[];
  /** 'card' for a news grid, 'compact' for a sidebar/announcement list. */
  variant?: 'card' | 'compact';
  columns?: 2 | 3 | 4;
  moreHref?: string;
  moreLabel?: string;
  emptyText?: string;
  className?: string;
}

const thaiDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Strips markup and clamps an excerpt so a listing never dumps raw HTML. */
const excerpt = (value?: string, max = 140) => {
  const text = (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

/**
 * News / announcement listing for a government site.
 *
 * Renders semantic `<article>` elements with real dates and headings so the
 * content is indexable from the server-rendered HTML.
 */
export const PostListComponent: React.FC<PostListComponentProps> = ({
  title,
  subtitle,
  items = [],
  variant = 'card',
  columns = 3,
  moreHref,
  moreLabel = 'ดูทั้งหมด',
  emptyText = 'ยังไม่มีข้อมูลในขณะนี้',
  className = '',
}) => {
  const colClass = { 2: 'col-md-6', 3: 'col-md-6 col-lg-4', 4: 'col-md-6 col-lg-3' }[columns];

  return (
    <div className={`gov-postlist ${className}`}>
      {(title || moreHref) && (
        <div className="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-3">
          <div>
            {title && <h2 className="gov-section-title h4 fw-bold mb-1">{title}</h2>}
            {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
          </div>
          {moreHref && (
            <a className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href={moreHref}>
              {moreLabel} <ArrowRight size={14} />
            </a>
          )}
        </div>
      )}

      {items.length === 0 && <p className="text-muted small mb-0">{emptyText}</p>}

      {variant === 'compact' ? (
        <ul className="list-unstyled mb-0">
          {items.map((item, index) => {
            const heading = item.name ?? item.title ?? '';
            const date = thaiDate(item.publish_at ?? item.created_at);
            return (
              <li key={String(item.id ?? index)} className="border-bottom py-2">
                <article>
                  <h3 className="h6 fw-semibold mb-1">
                    {item.url ? <a href={item.url} className="text-decoration-none">{heading}</a> : heading}
                  </h3>
                  {date && (
                    <p className="extra-small text-secondary mb-0 d-flex align-items-center gap-1">
                      <CalendarDays size={12} /> <time dateTime={String(item.publish_at ?? item.created_at ?? '')}>{date}</time>
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="row g-4">
          {items.map((item, index) => {
            const heading = item.name ?? item.title ?? '';
            const date = thaiDate(item.publish_at ?? item.created_at);
            const summary = excerpt(item.description);
            return (
              <div className={colClass} key={String(item.id ?? index)}>
                <article className="gov-card card h-100 border-0 shadow-sm">
                  {item.image && (
                    // Tenant images come from arbitrary URLs, so next/image cannot optimise them.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={heading}
                      className="card-img-top"
                      loading="lazy"
                      style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
                    />
                  )}
                  <div className="card-body d-flex flex-column">
                    {item.category && (
                      <span className="gov-badge-gold badge align-self-start mb-2">{item.category}</span>
                    )}
                    <h3 className="h6 fw-bold mb-2">
                      {item.url ? <a href={item.url} className="text-decoration-none stretched-link">{heading}</a> : heading}
                    </h3>
                    {summary && <p className="small text-secondary flex-grow-1 mb-2">{summary}</p>}
                    {date && (
                      <p className="extra-small text-secondary mb-0 d-flex align-items-center gap-1">
                        <CalendarDays size={12} /> <time dateTime={String(item.publish_at ?? item.created_at ?? '')}>{date}</time>
                      </p>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
