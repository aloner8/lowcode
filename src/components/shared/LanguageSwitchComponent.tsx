'use client';

import React, { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

export interface LanguageSwitchComponentProps {
  label?: string;
  /** Languages offered, as Google Translate codes. */
  languages?: Array<{ code: string; label: string }>;
  className?: string;
}

const DEFAULTS = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'lo', label: 'ລາວ' },
];

const SCRIPT_ID = 'gov-translate-script';

declare global {
  interface Window {
    google?: { translate?: { TranslateElement?: new (config: unknown, id: string) => void } };
    govTranslateInit?: () => void;
  }
}

/**
 * Machine translation of the page.
 *
 * The translator is Google's, and it reads the whole page to do its work. It is
 * therefore loaded only when a visitor actually asks for another language —
 * never on first paint — so nobody's reading is sent to a third party unless
 * they chose the feature. That also keeps the script off the critical path for
 * the Thai readers who are the overwhelming majority.
 */
export const LanguageSwitchComponent: React.FC<LanguageSwitchComponentProps> = ({
  label = 'ภาษา',
  languages = DEFAULTS,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const loadTranslator = () =>
    new Promise<void>((resolve, reject) => {
      if (window.google?.translate?.TranslateElement) return resolve();
      if (document.getElementById(SCRIPT_ID)) return resolve();

      window.govTranslateInit = () => {
        try {
          const Element = window.google?.translate?.TranslateElement;
          if (Element) new Element({ pageLanguage: 'th', autoDisplay: false }, 'gov-translate-host');
          setReady(true);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('translate init failed'));
        }
      };

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=govTranslateInit';
      script.async = true;
      script.onerror = () => reject(new Error('translate script failed'));
      document.body.appendChild(script);
    });

  const choose = async (code: string) => {
    setOpen(false);
    if (code === 'th') {
      // Returning to Thai means clearing the translator's own cookie.
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      window.location.reload();
      return;
    }

    setLoading(true);
    try {
      await loadTranslator();
      document.cookie = `googtrans=/th/${code}; path=/`;
      window.location.reload();
    } catch {
      setLoading(false);
      // Nothing breaks: the page stays in Thai and the control stays available.
    }
  };

  return (
    <div className={`gov-lang ${className}`}>
      <button
        type="button"
        className="gov-chip"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={loading}
      >
        <Languages size={13} aria-hidden="true" />
        {loading ? 'กำลังโหลด…' : label}
      </button>

      {open && (
        <ul className="gov-lang-menu" role="menu">
          <li className="gov-lang-note">
            แปลด้วยบริการของ Google — เนื้อหาหน้านี้จะถูกส่งไปแปลเมื่อเลือกภาษาอื่น
          </li>
          {languages.map((item) => (
            <li key={item.code}>
              <button type="button" role="menuitem" onClick={() => void choose(item.code)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Google mounts its own widget here; it stays hidden. */}
      <div id="gov-translate-host" hidden={!ready} className="visually-hidden" />
    </div>
  );
};
