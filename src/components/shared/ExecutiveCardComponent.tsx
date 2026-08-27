'use client';

import React from 'react';
import { Phone } from 'lucide-react';

export interface ExecutiveCardComponentProps {
  name?: string;
  position?: string;
  phone?: string;
  /** A real photograph, uploaded by the agency. Never generated. */
  photo?: string | null;
  className?: string;
}

/**
 * The single portrait card an agency puts beside its welcome video — the mayor
 * on one side, the clerk on the other.
 *
 * With no photograph it shows a silhouette: a portrait of a named public
 * official has to be an actual photograph of that person.
 */
export const ExecutiveCardComponent: React.FC<ExecutiveCardComponentProps> = ({
  name = 'ตำแหน่งว่าง',
  position,
  phone,
  photo = null,
  className = '',
}) => (
  <figure className={`gov-exec ${className}`}>
    {/* Agency photographs are uploaded files at arbitrary URLs. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={photo ?? '/img/mock/person.svg'}
      alt={photo ? name : ''}
      aria-hidden={photo ? undefined : true}
      className="gov-exec-photo"
      loading="lazy"
    />
    <figcaption className="gov-exec-plate">
      <span className="gov-exec-name">{name}</span>
      {position && <span className="gov-exec-role">{position}</span>}
      {phone && (
        <a className="gov-exec-phone" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
          <Phone size={12} aria-hidden="true" /> {phone}
        </a>
      )}
    </figcaption>
  </figure>
);
