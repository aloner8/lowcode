'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';

export interface VisitCounterComponentProps {
  title?: string;
  /** Site whose visits are counted; the runtime supplies it. */
  appSlug?: string;
  className?: string;
}

interface Totals {
  today: number;
  yesterday: number;
  month: number;
  total: number;
}

const ROWS: Array<[keyof Totals, string]> = [
  ['today', 'วันนี้'],
  ['yesterday', 'เมื่อวาน'],
  ['month', 'เดือนนี้'],
  ['total', 'ทั้งหมด'],
];

/**
 * Visit statistics, counted by this platform rather than an analytics vendor.
 *
 * Recording happens on mount, so the figure a reader sees already includes
 * their own visit — which is what a counter that says "today" should mean.
 * Nothing renders until real numbers arrive: a placeholder zero in a public
 * statistic reads as a real measurement.
 */
export const VisitCounterComponent: React.FC<VisitCounterComponentProps> = ({
  title = 'สถิติการเข้าชม',
  appSlug,
  className = '',
}) => {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    if (!appSlug) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/site/${encodeURIComponent(appSlug)}/visits`, {
          method: 'POST',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json() as { visits?: Totals };
        if (!cancelled && payload.visits) setTotals(payload.visits);
      } catch {
        // A counter is not worth an error message to the public; it stays hidden.
      }
    })();

    return () => { cancelled = true; };
  }, [appSlug]);

  if (!totals) return null;

  return (
    <section className={`gov-visits ${className}`}>
      <p className="gov-footer-heading">
        <BarChart3 size={15} aria-hidden="true" /> {title}
      </p>
      <dl className="gov-visit-list">
        {ROWS.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{totals[key].toLocaleString('th-TH')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
