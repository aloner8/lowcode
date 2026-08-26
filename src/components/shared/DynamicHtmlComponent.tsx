'use client';

import React, { useEffect, useState } from 'react';

export interface DynamicHtmlProps {
  content?: string; // HTML string
  className?: string;
  data?: Record<string, any>;
  contentId?: string;
  appSlug?: string;
  refreshIntervalMs?: number;
  onAction?: (actionId: string) => void;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));

export const DynamicHtmlComponent: React.FC<DynamicHtmlProps> = ({ content, className = '', data = {}, contentId, appSlug, refreshIntervalMs = 0, onAction }) => {
  const [remote, setRemote] = useState<{ html?: string; data?: Record<string, any> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!contentId || !appSlug) { setRemote(null); setError(null); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}/content/${encodeURIComponent(contentId)}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load runtime content');
        if (active) { setRemote(result); setError(null); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load runtime content'); }
    };
    void load();
    const timer = refreshIntervalMs > 0 ? window.setInterval(load, Math.max(refreshIntervalMs, 1000)) : undefined;
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [appSlug, contentId, refreshIntervalMs]);
  const html = remote?.html ?? content;
  const bindingData = remote?.data ?? data;
  const renderedContent = (html || '<div>Empty HTML Content</div>').replace(/{{\s*([\w.]+)\s*}}/g, (_match, path: string) => {
    const value = path.split('.').reduce<any>((current, key) => current?.[key], bindingData);
    return escapeHtml(value);
  });
  if (error) return <div className="alert alert-danger">{error}</div>;
  return (
    <div
      className={`dynamic-html-container ${className}`}
      onClick={(event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-auth-action]');
        if (target?.dataset.authAction && onAction) onAction(target.dataset.authAction);
      }}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};
