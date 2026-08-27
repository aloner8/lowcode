'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface AdminModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly wide?: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  /** Buttons for the footer bar; omitted for read-only dialogs. */
  readonly footer?: React.ReactNode;
  /** Wraps the body in a form so Enter submits, as a dialog should. */
  readonly onSubmit?: (event: React.FormEvent) => void;
}

/**
 * The console's dialog.
 *
 * Written once because the five screens that need a dialog were each carrying
 * their own copy of the backdrop, header and footer markup — and none of them
 * closed on Escape or moved focus into the dialog.
 */
export default function AdminModal({
  isOpen,
  title,
  subtitle,
  wide = false,
  onClose,
  children,
  footer,
  onSubmit,
}: AdminModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // Focus the first control so keyboard users are not left on the page behind.
    const focusable = cardRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.adm-modal-close)',
    );
    focusable?.focus();

    // The page behind must not scroll under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const inner = (
    <>
      <div className="adm-modal-head">
        <div>
          <h2 className="adm-modal-title" id={titleId}>{title}</h2>
          {subtitle && <p className="adm-modal-sub">{subtitle}</p>}
        </div>
        <button type="button" className="adm-modal-close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
      </div>
      <div className="adm-modal-body">{children}</div>
      {footer && <div className="adm-modal-foot">{footer}</div>}
    </>
  );

  return (
    <div
      className="adm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`adm-modal-card ${wide ? 'is-wide' : ''}`} ref={cardRef}>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="d-flex flex-column overflow-hidden">{inner}</form>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}
