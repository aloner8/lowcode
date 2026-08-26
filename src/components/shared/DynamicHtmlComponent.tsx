'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderSafeHtml } from '@/lib/security/sanitizeHtml';

export interface DynamicHtmlProps {
  content?: string; // HTML string authored in Studio or stored in the database
  className?: string;
  data?: Record<string, any>;
  contentId?: string;
  appSlug?: string;
  refreshIntervalMs?: number;
  onAction?: (actionId: string) => void;
}

/**
 * Renders author-supplied HTML, either from props or fetched live by content id.
 *
 * The markup is untrusted wherever it comes from, so data is interpolated first
 * and the whole string then passes through the allow-list sanitizer before it
 * reaches `dangerouslySetInnerHTML`.
 */
export const DynamicHtmlComponent: React.FC<DynamicHtmlProps> = ({
  content,
  className = '',
  data = {},
  contentId,
  appSlug,
  refreshIntervalMs = 0,
  onAction,
}) => {
  const [remote, setRemote] = useState<{ html?: string; data?: Record<string, any> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentId || !appSlug) {
      setRemote(null);
      setError(null);
      return;
    }
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/runtime/${encodeURIComponent(appSlug)}/content/${encodeURIComponent(contentId)}`,
          { cache: 'no-store' },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load runtime content');
        if (active) {
          setRemote(result);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load runtime content');
      }
    };

    void load();
    const timer = refreshIntervalMs > 0
      ? window.setInterval(load, Math.max(refreshIntervalMs, 1000))
      : undefined;
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [appSlug, contentId, refreshIntervalMs]);

  const html = remote?.html ?? content;
  const bindingData = remote?.data ?? data;

  const safeHtml = useMemo(
    () => renderSafeHtml(html || '<div>Empty HTML Content</div>', bindingData),
    [html, bindingData],
  );

  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div
      className={`dynamic-html-container ${className}`}
      onClick={(event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-auth-action]');
        if (target?.dataset.authAction && onAction) onAction(target.dataset.authAction);
      }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};
