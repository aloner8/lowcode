'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

export interface CalendarEvent {
  id?: string | number;
  name?: string;
  title?: string;
  publish_at?: string | null;
  created_at?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

export interface EventCalendarComponentProps {
  title?: string;
  subtitle?: string;
  items?: CalendarEvent[];
  emptyText?: string;
  className?: string;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/**
 * Month view of agency activities.
 *
 * Built from the same articles the activity listing shows, so a calendar entry
 * always leads to something real. Days are `<button>`s only when they hold an
 * event; an empty square is not a control.
 */
export const EventCalendarComponent: React.FC<EventCalendarComponentProps> = ({
  title = 'ปฏิทินกิจกรรม',
  subtitle,
  items = [],
  emptyText = 'ยังไม่มีกิจกรรมในเดือนนี้',
  className = '',
}) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const item of items) {
      const raw = item.publish_at ?? item.created_at;
      if (!raw) continue;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const move = (delta: number) => {
    setCursor(new Date(year, month + delta, 1));
    setSelected(null);
  };

  const shown = selected ? byDay.get(selected) ?? [] : [];
  const monthEvents = [...byDay.entries()]
    .filter(([key]) => key.startsWith(`${year}-${month + 1}-`))
    .flatMap(([, list]) => list);

  return (
    <section className={`gov-calendar ${className}`}>
      <div className="gov-calendar-head">
        <div>
          <h2 className="gov-section-title h5 fw-bold mb-1">
            <CalendarDays size={17} aria-hidden="true" /> {title}
          </h2>
          {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
        </div>
        <div className="gov-calendar-nav">
          <button type="button" onClick={() => move(-1)} aria-label="เดือนก่อนหน้า">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span aria-live="polite">{THAI_MONTHS[month]} {year + 543}</span>
          <button type="button" onClick={() => move(1)} aria-label="เดือนถัดไป">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <table className="gov-calendar-grid">
        <caption className="visually-hidden">
          ปฏิทินกิจกรรมเดือน {THAI_MONTHS[month]} {year + 543}
        </caption>
        <thead>
          <tr>{THAI_DAYS.map((d) => <th key={d} scope="col">{d}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => (
            <tr key={week}>
              {cells.slice(week * 7, week * 7 + 7).map((day, index) => {
                if (day === null) return <td key={`e-${index}`} />;
                const key = `${year}-${month + 1}-${day}`;
                const count = byDay.get(key)?.length ?? 0;
                return (
                  <td key={key}>
                    {count > 0 ? (
                      <button
                        type="button"
                        className={`gov-calendar-day has-event ${selected === key ? 'is-selected' : ''}`}
                        onClick={() => setSelected(selected === key ? null : key)}
                        aria-label={`วันที่ ${day} มี ${count} กิจกรรม`}
                        aria-pressed={selected === key}
                      >
                        {day}
                        <span className="gov-calendar-dot" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="gov-calendar-day">{day}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="gov-calendar-list" aria-live="polite">
        {(selected ? shown : monthEvents).length === 0 ? (
          <p className="text-muted small mb-0">{emptyText}</p>
        ) : (
          <ul>
            {(selected ? shown : monthEvents).slice(0, 8).map((item, index) => (
              <li key={String(item.id ?? index)}>
                <a href={item.url ?? '#'}>{item.name ?? item.title}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
