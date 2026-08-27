import React from 'react';
import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';

interface StatWidgetCardProps {
  readonly label: string;
  readonly value: number | string;
  /** Rendered smaller beside the figure — "เว็บ", "บัญชี", "หน้า". */
  readonly unit?: string;
  readonly hint?: string;
  readonly icon: LucideIcon;
  /** Turns the whole tile into a link to the screen that manages this figure. */
  readonly href?: string;
}

/**
 * A single headline figure.
 *
 * The number carries the meaning, so it is the only thing at display size; the
 * icon is a quiet marker in the shared blue rather than a coloured block
 * competing with it. Where a figure has a screen behind it the tile links
 * there, which is the action an operator wants next.
 */
export default function StatWidgetCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  href,
}: StatWidgetCardProps) {
  const body = (
    <span className="adm-stat">
      <span className="min-w-0">
        <span className="adm-stat-label d-block">{label}</span>
        <span className="d-block">
          <span className="adm-stat-value">{value}</span>
          {unit && <span className="adm-stat-unit">{unit}</span>}
        </span>
        {hint && <span className="adm-stat-sub d-block text-truncate">{hint}</span>}
      </span>
      <span className="adm-stat-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="adm-card d-block h-100 text-decoration-none">
        {body}
      </Link>
    );
  }

  return <div className="adm-card h-100">{body}</div>;
}
