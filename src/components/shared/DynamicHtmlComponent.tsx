'use client';

import React, { useMemo } from 'react';
import { renderSafeHtml } from '@/lib/security/sanitizeHtml';

export interface DynamicHtmlProps {
  content: string; // HTML string authored in Studio or stored in the database
  className?: string;
  data?: Record<string, any>;
}

/**
 * Renders author-supplied HTML.
 *
 * The markup comes from the database, so it is treated as untrusted: data is
 * interpolated first, then the whole string passes through the allow-list
 * sanitizer before it ever reaches `dangerouslySetInnerHTML`.
 */
export const DynamicHtmlComponent: React.FC<DynamicHtmlProps> = ({ content, className = '', data = {} }) => {
  const safeHtml = useMemo(
    () => renderSafeHtml(content || '<div>Empty HTML Content</div>', data),
    [content, data],
  );

  return (
    <div
      className={`dynamic-html-container ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};
