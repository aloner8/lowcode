'use client';

import React from 'react';
import { Phone, Mail, UserRound } from 'lucide-react';

export interface Person {
  name: string;
  position?: string;
  /** A real photograph, uploaded by the agency. Never generated. */
  photo?: string | null;
  phone?: string;
  email?: string;
}

export interface PeopleGridComponentProps {
  title?: string;
  subtitle?: string;
  items?: Person[];
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * Executives or staff of an agency.
 *
 * With no photograph the card shows a neutral silhouette: a portrait of a real
 * public official must be an actual photograph, so nothing stands in for one.
 */
export const PeopleGridComponent: React.FC<PeopleGridComponentProps> = ({
  title,
  subtitle,
  items = [],
  columns = 4,
  className = '',
}) => {
  const colClass = { 2: 'col-6', 3: 'col-6 col-lg-4', 4: 'col-6 col-lg-3' }[columns];

  return (
    <section className={`gov-people ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <h2 className="gov-section-title h4 fw-bold mb-1">{title}</h2>}
          {subtitle && <p className="text-secondary small mb-0">{subtitle}</p>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted small mb-0">ยังไม่ได้เพิ่มข้อมูลบุคลากร</p>
      ) : (
        <div className="row g-3">
          {items.map((person, index) => (
            <div className={colClass} key={`${person.name}-${index}`}>
              <figure className="gov-person">
                {person.photo ? (
                  // Uploaded by the agency; an arbitrary URL, so next/image cannot optimise it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photo} alt={person.name} className="gov-person-photo" loading="lazy" />
                ) : (
                  <span className="gov-person-photo gov-person-placeholder" aria-hidden="true">
                    <UserRound size={34} />
                  </span>
                )}
                <figcaption>
                  <span className="gov-person-name">{person.name}</span>
                  {person.position && <span className="gov-person-role">{person.position}</span>}
                  <span className="gov-person-contact">
                    {person.phone && (
                      <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} aria-label={`โทรหา ${person.name}`}>
                        <Phone size={13} aria-hidden="true" />
                      </a>
                    )}
                    {person.email && (
                      <a href={`mailto:${person.email}`} aria-label={`ส่งอีเมลถึง ${person.name}`}>
                        <Mail size={13} aria-hidden="true" />
                      </a>
                    )}
                  </span>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
