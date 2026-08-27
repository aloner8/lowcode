'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageNumbers } from '@/lib/site/pageNumbers';

export interface PagerProps {
  page?: number;
  pageCount?: number;
  total?: number;
  /** Base path of the listing; the page number is added as `?page=`. */
  basePath?: string;
  className?: string;
}

/**
 * Page links for a listing.
 *
 * Real links with an `href`, not buttons: a visitor can open page three in a
 * new tab, bookmark it, or share it, and a crawler can follow it to the rest of
 * the archive. Around a long run only a window of numbers is shown, so page 40
 * of 60 does not print sixty links.
 */
export const PagerComponent: React.FC<PagerProps> = ({
  page = 1,
  pageCount = 1,
  total,
  basePath = '',
  className = '',
}) => {
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(1, page), pageCount);
  const href = (n: number) => (n <= 1 ? basePath || '?' : `${basePath}?page=${n}`);

  const numbers = pageNumbers(current, pageCount);

  return (
    <nav className={`gov-pager ${className}`} aria-label="แบ่งหน้า">
      {typeof total === 'number' && (
        <p className="gov-pager-count">ทั้งหมด {total.toLocaleString('th-TH')} รายการ</p>
      )}
      <ul className="gov-pager-list">
        <li>
          <a
            className={`gov-pager-link ${current === 1 ? 'is-disabled' : ''}`}
            href={current === 1 ? undefined : href(current - 1)}
            aria-disabled={current === 1}
            aria-label="หน้าก่อนหน้า"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </a>
        </li>

        {numbers.map((n, index) =>
          (n === 'gap' ? (
            <li key={`gap-${index}`} className="gov-pager-gap" aria-hidden="true">…</li>
          ) : (
            <li key={n}>
              <a
                className={`gov-pager-link ${n === current ? 'is-active' : ''}`}
                href={href(n)}
                aria-current={n === current ? 'page' : undefined}
                aria-label={`หน้า ${n}`}
              >
                {n}
              </a>
            </li>
          )))}

        <li>
          <a
            className={`gov-pager-link ${current === pageCount ? 'is-disabled' : ''}`}
            href={current === pageCount ? undefined : href(current + 1)}
            aria-disabled={current === pageCount}
            aria-label="หน้าถัดไป"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </a>
        </li>
      </ul>
    </nav>
  );
};
