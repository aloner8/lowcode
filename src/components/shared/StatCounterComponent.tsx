'use client';

import React from 'react';
import { Users, Eye, FileText, Building2, CalendarDays, MapPin, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  visitors: Eye,
  people: Users,
  documents: FileText,
  offices: Building2,
  events: CalendarDays,
  area: MapPin,
};

export interface StatItem {
  label: string;
  value: number | string;
  unit?: string;
  icon?: keyof typeof ICONS;
}

export interface StatCounterComponentProps {
  title?: string;
  items?: StatItem[];
  className?: string;
}

/** Thai digits group in threes like Latin ones; the locale keeps it consistent. */
const format = (value: number | string) =>
  typeof value === 'number' ? value.toLocaleString('th-TH') : value;

/**
 * A row of headline figures — population, visitors, documents published.
 *
 * Values are supplied by the page, never invented here: a statistic with no
 * source behind it is worse than no statistic.
 */
export const StatCounterComponent: React.FC<StatCounterComponentProps> = ({
  title,
  items = [],
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <section className={`gov-stats ${className}`}>
      {title && <h2 className="gov-section-title h4 fw-bold mb-3">{title}</h2>}
      <div className="row g-3">
        {items.map((item, index) => {
          const Icon = ICONS[item.icon ?? 'visitors'] ?? Eye;
          return (
            <div className="col-6 col-lg-3" key={`${item.label}-${index}`}>
              <div className="gov-stat">
                <span className="gov-stat-icon" aria-hidden="true"><Icon size={20} /></span>
                <span className="gov-stat-value">
                  {format(item.value)}
                  {item.unit && <span className="gov-stat-unit">{item.unit}</span>}
                </span>
                <span className="gov-stat-label">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
