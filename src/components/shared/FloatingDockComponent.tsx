'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp, MessageCircle, Phone } from 'lucide-react';

export interface FloatingDockComponentProps {
  /** Messenger / LINE / chat destination. */
  contactUrl?: string | null;
  contactLabel?: string;
  phone?: string | null;
  className?: string;
}

/**
 * The small stack of shortcuts pinned to the corner of a government site.
 *
 * The scroll-to-top button only appears once there is something to scroll back
 * from, and it respects a reduced-motion preference rather than always
 * animating the jump.
 */
export const FloatingDockComponent: React.FC<FloatingDockComponentProps> = ({
  contactUrl = null,
  contactLabel = 'ติดต่อเจ้าหน้าที่',
  phone = null,
  className = '',
}) => {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <div className={`gov-dock ${className}`}>
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="gov-dock-btn" aria-label={`โทร ${phone}`}>
          <Phone size={19} aria-hidden="true" />
        </a>
      )}

      {contactUrl && (
        <a
          href={contactUrl}
          className="gov-dock-btn"
          target="_blank"
          rel="noreferrer"
          aria-label={`${contactLabel} (เปิดในแท็บใหม่)`}
        >
          <MessageCircle size={19} aria-hidden="true" />
        </a>
      )}

      {showTop && (
        <button type="button" className="gov-dock-btn is-top" onClick={toTop} aria-label="กลับขึ้นด้านบน">
          <ArrowUp size={19} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
