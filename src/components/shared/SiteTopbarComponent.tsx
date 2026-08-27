'use client';

import React, { useEffect, useState } from 'react';
import { Phone, Mail, Facebook, Youtube, RotateCcw, Plus, Minus } from 'lucide-react';
import { LanguageSwitchComponent } from './LanguageSwitchComponent';

export interface SiteTopbarComponentProps {
  phone?: string;
  email?: string;
  facebookLabel?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  lineUrl?: string;
  /** Offers machine translation; the translator loads only when chosen. */
  showLanguage?: boolean;
  className?: string;
}

const STORAGE_KEY = 'gov:font-scale';
const MIN = 0.85;
const MAX = 1.35;
const STEP = 0.1;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The strip above the header: how to reach the agency, and the text-size
 * control Thai government sites are expected to carry.
 *
 * The size steps up and down from the current value rather than offering three
 * fixed sizes, and is remembered per browser — a visitor who needs larger text
 * needs it on every page, not only where they pressed the button.
 */
export const SiteTopbarComponent: React.FC<SiteTopbarComponentProps> = ({
  phone,
  email,
  facebookLabel,
  facebookUrl,
  youtubeUrl,
  lineUrl,
  showLanguage = false,
  className = '',
}) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      if (stored >= MIN && stored <= MAX) setScale(stored);
    } catch {
      // Private browsing can refuse storage; the default size is fine.
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--gov-font-scale', String(scale));
  }, [scale]);

  const apply = (next: number) => {
    const value = round(Math.min(MAX, Math.max(MIN, next)));
    setScale(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Remembering is a convenience, not a requirement.
    }
  };

  return (
    <div className={`gov-topbar ${className}`}>
      <div className="gov-topbar-inner">
        <div className="gov-topbar-chips">
          {facebookUrl && (
            <a href={facebookUrl} className="gov-chip" target="_blank" rel="noreferrer">
              <Facebook size={13} aria-hidden="true" />
              {facebookLabel ?? 'Facebook'}
              <span className="visually-hidden">(เปิดในแท็บใหม่)</span>
            </a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="gov-chip">
              <Phone size={13} aria-hidden="true" /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="gov-chip">
              <Mail size={13} aria-hidden="true" /> {email}
            </a>
          )}
          {youtubeUrl && (
            <a href={youtubeUrl} className="gov-chip" target="_blank" rel="noreferrer">
              <Youtube size={13} aria-hidden="true" /> YouTube
              <span className="visually-hidden">(เปิดในแท็บใหม่)</span>
            </a>
          )}
          {lineUrl && (
            <a href={lineUrl} className="gov-chip" target="_blank" rel="noreferrer">
              LINE<span className="visually-hidden"> (เปิดในแท็บใหม่)</span>
            </a>
          )}
        </div>

        <div className="gov-topbar-tools">
          {showLanguage && <LanguageSwitchComponent />}
        </div>

        <div className="gov-topbar-tools" role="group" aria-label="ปรับขนาดตัวอักษร">
          <span className="gov-topbar-tools-label">ขนาดอักษร</span>
          <button
            type="button"
            className="gov-round-btn"
            onClick={() => apply(scale + STEP)}
            disabled={scale >= MAX}
            aria-label="เพิ่มขนาดตัวอักษร"
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="gov-round-btn"
            onClick={() => apply(scale - STEP)}
            disabled={scale <= MIN}
            aria-label="ลดขนาดตัวอักษร"
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="gov-round-btn"
            onClick={() => apply(1)}
            disabled={scale === 1}
            aria-label="คืนขนาดตัวอักษรเป็นค่าเริ่มต้น"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <span className="visually-hidden" aria-live="polite">
            ขนาดตัวอักษร {Math.round(scale * 100)} เปอร์เซ็นต์
          </span>
        </div>
      </div>
    </div>
  );
};
