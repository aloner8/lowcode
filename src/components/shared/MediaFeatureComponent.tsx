'use client';

import React from 'react';
import { ArrowRight, PlayCircle, MapPin, Megaphone, type LucideIcon } from 'lucide-react';

const MARKS: Record<string, LucideIcon> = {
  play: PlayCircle,
  map: MapPin,
  alert: Megaphone,
};

export interface MediaFeatureComponentProps {
  title?: string;
  subtitle?: string;
  image?: string | null;
  alt?: string;
  href?: string;
  buttonLabel?: string;
  /** Overlaid marker: a play badge for video, a pin for a map. */
  mark?: keyof typeof MARKS;
  /** Set for a pale illustration, which a grey scrim would wash out. */
  light?: boolean;
  external?: boolean;
  className?: string;
}

/**
 * A wide banner card: one picture, a heading and one action.
 *
 * Agency home pages carry several of these — the emergency-alert strip, the
 * introduction video, the map — which differ only in picture and wording, so
 * they share a component rather than three near-identical ones.
 */
export const MediaFeatureComponent: React.FC<MediaFeatureComponentProps> = ({
  title,
  subtitle,
  image = null,
  alt = '',
  href,
  buttonLabel,
  mark,
  light = false,
  external = false,
  className = '',
}) => {
  const Mark = mark ? MARKS[mark] : null;
  const body = (
    <>
      {image && (
        // Agency media are uploaded files at arbitrary URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt} className="gov-feature-img" loading="lazy" />
      )}
      <span className="gov-feature-overlay">
        {Mark && <Mark size={44} className="gov-feature-mark" aria-hidden="true" />}
        {title && <span className="gov-feature-title">{title}</span>}
        {subtitle && <span className="gov-feature-sub">{subtitle}</span>}
        {buttonLabel && (
          <span className="gov-feature-btn">
            {buttonLabel} <ArrowRight size={15} aria-hidden="true" />
            {external && <span className="visually-hidden">(เปิดในแท็บใหม่)</span>}
          </span>
        )}
      </span>
    </>
  );

  return (
    <section className={`gov-feature ${light ? 'is-light' : ''} ${className}`}>
      {href ? (
        <a
          className="gov-feature-link"
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          {body}
        </a>
      ) : (
        <div className="gov-feature-link">{body}</div>
      )}
    </section>
  );
};
