'use client';

import React from 'react';

export interface PartnerLink {
  label: string;
  href?: string;
  /** Official mark of the other body. Never generated or substituted. */
  logo?: string | null;
}

export interface PartnerStripComponentProps {
  title?: string;
  items?: PartnerLink[];
  className?: string;
}

/**
 * The row of links to related government bodies.
 *
 * Each mark belongs to another organisation, so where none has been uploaded a
 * neutral plate stands in — an invented crest would misrepresent that body.
 */
export const PartnerStripComponent: React.FC<PartnerStripComponentProps> = ({
  title,
  items = [],
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <section className={`gov-partners ${className}`}>
      {title && <h2 className="gov-section-title h5 fw-bold mb-3">{title}</h2>}
      <ul className="gov-partner-list">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <a href={item.href ?? '#'} target="_blank" rel="noreferrer" title={item.label}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.logo ?? '/img/mock/partner.svg'} alt={item.label} loading="lazy" />
              <span className="visually-hidden">(เปิดในแท็บใหม่)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
