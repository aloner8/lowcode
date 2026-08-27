'use client';

import React, { useEffect, useState } from 'react';
import { Phone, Mail, Facebook, Youtube, Type } from 'lucide-react';

export interface SiteTopbarComponentProps {
  phone?: string;
  email?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  lineUrl?: string;
  className?: string;
}

const STEPS = [
  { id: 'small', label: 'ก-', scale: 0.9, name: 'ตัวอักษรเล็ก' },
  { id: 'normal', label: 'ก', scale: 1, name: 'ตัวอักษรปกติ' },
  { id: 'large', label: 'ก+', scale: 1.15, name: 'ตัวอักษรใหญ่' },
] as const;

const STORAGE_KEY = 'gov:font-scale';

/**
 * The strip above the header: how to reach the agency, and the text-size
 * control that Thai government sites are expected to carry.
 *
 * The chosen size is remembered per browser, because a visitor who needs larger
 * text needs it on every page, not just the one where they pressed the button.
 */
export const SiteTopbarComponent: React.FC<SiteTopbarComponentProps> = ({
  phone,
  email,
  facebookUrl,
  youtubeUrl,
  lineUrl,
  className = '',
}) => {
  const [scaleId, setScaleId] = useState<string>('normal');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && STEPS.some((step) => step.id === stored)) setScaleId(stored);
    } catch {
      // Private browsing can refuse storage; the default size is fine.
    }
  }, []);

  useEffect(() => {
    const step = STEPS.find((item) => item.id === scaleId) ?? STEPS[1];
    document.documentElement.style.setProperty('--gov-font-scale', String(step.scale));
  }, [scaleId]);

  const choose = (id: string) => {
    setScaleId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Remembering is a convenience, not a requirement.
    }
  };

  const socials = [
    { url: facebookUrl, Icon: Facebook, name: 'Facebook' },
    { url: youtubeUrl, Icon: Youtube, name: 'YouTube' },
  ].filter((item) => Boolean(item.url));

  return (
    <div className={`gov-topbar ${className}`}>
      <div className="gov-topbar-inner">
        <div className="gov-topbar-contact">
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="gov-topbar-link">
              <Phone size={13} aria-hidden="true" /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="gov-topbar-link">
              <Mail size={13} aria-hidden="true" /> {email}
            </a>
          )}
        </div>

        <div className="gov-topbar-tools">
          <div className="gov-fontsize" role="group" aria-label="ปรับขนาดตัวอักษร">
            <Type size={13} aria-hidden="true" className="gov-fontsize-icon" />
            {STEPS.map((step) => (
              <button
                key={step.id}
                type="button"
                className={`gov-fontsize-btn ${scaleId === step.id ? 'is-active' : ''}`}
                onClick={() => choose(step.id)}
                aria-pressed={scaleId === step.id}
                aria-label={step.name}
              >
                {step.label}
              </button>
            ))}
          </div>

          {socials.length > 0 && (
            <div className="gov-topbar-social">
              {socials.map(({ url, Icon, name }) => (
                <a
                  key={name}
                  href={url}
                  className="gov-topbar-link"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${name} (เปิดในแท็บใหม่)`}
                >
                  <Icon size={14} aria-hidden="true" />
                </a>
              ))}
              {lineUrl && (
                <a
                  href={lineUrl}
                  className="gov-topbar-link"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LINE (เปิดในแท็บใหม่)"
                >
                  LINE
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
