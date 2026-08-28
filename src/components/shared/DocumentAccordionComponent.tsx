'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, FileText, ExternalLink, Link2 } from 'lucide-react';

export interface DocumentLink {
  label: string;
  href?: string;
  /** `pdf` for a document, `link` for a page elsewhere. Drives the badge. */
  kind?: 'pdf' | 'link';
  /** Optional heading that starts a run of related links inside a group. */
  subgroup?: string;
}

export interface DocumentGroup {
  label: string;
  items?: DocumentLink[];
  /** Open on first paint. The first group is opened when none says so. */
  open?: boolean;
}

export interface DocumentAccordionComponentProps {
  title?: string;
  subtitle?: string;
  groups?: DocumentGroup[];
  emptyText?: string;
  className?: string;
}

const BADGE = {
  pdf: { label: 'PDF', Icon: FileText },
  link: { label: 'ลิงก์', Icon: Link2 },
} as const;

/**
 * The disclosure list an agency publishes for its integrity assessment.
 *
 * Thirty-odd documents across four headings is far too much to leave open, so
 * each heading collapses — but every panel stays in the HTML and is only
 * hidden, which keeps the whole list server-rendered and indexable. Each entry
 * says whether it opens a document or another page, because the two behave
 * differently and a visitor deserves to know before clicking.
 */
export const DocumentAccordionComponent: React.FC<DocumentAccordionComponentProps> = ({
  title,
  subtitle,
  groups = [],
  emptyText = 'ยังไม่ได้เผยแพร่เอกสารในหมวดนี้',
  className = '',
}) => {
  const baseId = useId().replace(/:/g, '');
  const [open, setOpen] = useState<Record<number, boolean>>(() => {
    const declared = groups.some((group) => group.open);
    return Object.fromEntries(
      groups.map((group, index) => [index, declared ? Boolean(group.open) : index === 0]),
    );
  });

  if (groups.length === 0) return null;

  return (
    <section className={`gov-disclosure ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <h2 className="gov-section-title h4 fw-bold mb-1">{title}</h2>}
          {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
        </div>
      )}

      <div className="gov-disclosure-list">
        {groups.map((group, index) => {
          const expanded = open[index] ?? false;
          const count = group.items?.length ?? 0;

          return (
            <div className="gov-disclosure-group" key={group.label}>
              <h3 className="gov-disclosure-heading">
                <button
                  type="button"
                  className={`gov-disclosure-toggle ${expanded ? 'is-open' : ''}`}
                  aria-expanded={expanded}
                  aria-controls={`${baseId}-panel-${index}`}
                  onClick={() => setOpen((current) => ({ ...current, [index]: !current[index] }))}
                >
                  <span className="gov-disclosure-label">{group.label}</span>
                  {count > 0 && <span className="gov-disclosure-count">{count}</span>}
                  <ChevronDown size={18} className="gov-disclosure-caret" aria-hidden="true" />
                </button>
              </h3>

              <div id={`${baseId}-panel-${index}`} className="gov-disclosure-panel" hidden={!expanded}>
                {count === 0 ? (
                  <p className="text-muted small mb-0 px-3 py-2">{emptyText}</p>
                ) : (
                  <ul className="gov-disclosure-items">
                    {group.items?.map((item, itemIndex) => {
                      const kind = item.kind === 'link' ? 'link' : 'pdf';
                      const { label, Icon } = BADGE[kind];
                      const external = kind === 'link' && /^https?:\/\//i.test(item.href ?? '');
                      return (
                        <React.Fragment key={`${item.label}-${itemIndex}`}>
                          {item.subgroup && (
                            <li className="gov-disclosure-subgroup" aria-hidden="true">{item.subgroup}</li>
                          )}
                          <li>
                            <a
                              href={item.href ?? '#'}
                              {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                            >
                              <span className={`gov-disclosure-icon is-${kind}`} aria-hidden="true">
                                <Icon size={15} />
                              </span>
                              <span className="gov-disclosure-text">{item.label}</span>
                              <span className={`gov-disclosure-badge is-${kind}`}>{label}</span>
                              {external && (
                                <ExternalLink size={13} aria-hidden="true" className="gov-disclosure-ext" />
                              )}
                              {external && <span className="visually-hidden">(เปิดในแท็บใหม่)</span>}
                            </a>
                          </li>
                        </React.Fragment>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
