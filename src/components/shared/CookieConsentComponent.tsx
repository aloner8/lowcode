'use client';

import React, { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

export interface CookieConsentComponentProps {
  message?: string;
  policyHref?: string;
  policyLabel?: string;
  acceptLabel?: string;
  declineLabel?: string;
  className?: string;
}

const STORAGE_KEY = 'gov:cookie-consent';

/**
 * The consent bar across the foot of the page.
 *
 * Nothing here sets a tracking cookie, so declining is a real choice rather
 * than a button that does the same thing as accepting: the answer is recorded
 * in this browser only, and the bar stays away either way.
 *
 * It renders nothing until the stored answer has been read, so a visitor who
 * already answered never sees it flash back on the next page.
 */
export const CookieConsentComponent: React.FC<CookieConsentComponentProps> = ({
  message = 'เว็บไซต์นี้ใช้คุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์ เพื่อให้ท่านใช้งานได้อย่างต่อเนื่อง',
  policyHref = '/privacy',
  policyLabel = 'นโยบายความเป็นส่วนตัว',
  acceptLabel = 'ยอมรับทั้งหมด',
  declineLabel = 'ใช้เฉพาะที่จำเป็น',
  className = '',
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage can be refused; showing the bar once per visit is acceptable.
      setVisible(true);
    }
  }, []);

  const answer = (value: 'all' | 'necessary') => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The answer simply is not remembered; nothing else depends on it.
    }
  };

  if (!visible) return null;

  return (
    <div className={`gov-cookie ${className}`} role="region" aria-label="การใช้คุกกี้">
      <span className="gov-cookie-icon" aria-hidden="true"><Cookie size={20} /></span>
      <p className="gov-cookie-text">
        {message}{' '}
        <a href={policyHref}>{policyLabel}</a>
      </p>
      <div className="gov-cookie-actions">
        <button type="button" className="gov-cookie-btn is-quiet" onClick={() => answer('necessary')}>
          {declineLabel}
        </button>
        <button type="button" className="gov-cookie-btn" onClick={() => answer('all')}>
          {acceptLabel}
        </button>
        <button
          type="button"
          className="gov-cookie-close"
          onClick={() => answer('necessary')}
          aria-label="ปิดแถบแจ้งเตือนคุกกี้"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
};
