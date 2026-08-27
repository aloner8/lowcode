'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface FloatingNoticeItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  /** Official mark of the body concerned. Never generated or substituted. */
  logo?: string | null;
}

export interface FloatingNoticeComponentProps {
  items?: FloatingNoticeItem[];
  className?: string;
}

const STORAGE_KEY = 'gov:notices-dismissed';

/**
 * The complaint-channel cards pinned to the side of an agency home page.
 *
 * Each closes for good in this browser rather than reappearing on every page,
 * and the whole stack is hidden below `lg` where it would cover the content it
 * sits over.
 */
export const FloatingNoticeComponent: React.FC<FloatingNoticeComponentProps> = ({
  items = [],
  className = '',
}) => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setDismissed(JSON.parse(stored) as string[]);
    } catch {
      // Storage can be refused or hold something unparseable; show them all.
    }
    setLoaded(true);
  }, []);

  const close = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Remembering is a convenience, not a requirement.
    }
  };

  // Nothing renders until the stored answer is known, so a card the visitor
  // already closed never flashes back on the next page.
  if (!loaded) return null;
  const visible = items.filter((item) => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  return (
    <aside className={`gov-notices-float d-none d-lg-flex ${className}`} aria-label="ช่องทางร้องเรียน">
      {visible.map((item) => (
        <div className="gov-float-card" key={item.id}>
          <a href={item.href} target="_blank" rel="noreferrer" className="gov-float-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.logo ?? '/img/mock/partner.svg'} alt="" aria-hidden="true" />
            <span>
              <span className="gov-float-sub">{item.sublabel ?? 'ช่องทางร้องเรียน'}</span>
              <span className="gov-float-label">{item.label}</span>
            </span>
            <span className="visually-hidden">(เปิดในแท็บใหม่)</span>
          </a>
          <button
            type="button"
            className="gov-float-close"
            onClick={() => close(item.id)}
            aria-label={`ปิด ${item.label}`}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
    </aside>
  );
};
