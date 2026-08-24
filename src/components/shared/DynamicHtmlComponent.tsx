'use client';

import React from 'react';

export interface DynamicHtmlProps {
  content: string; // HTML string
  className?: string;
  data?: Record<string, any>;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));

export const DynamicHtmlComponent: React.FC<DynamicHtmlProps> = ({ content, className = '', data = {} }) => {
  const renderedContent = (content || '<div>Empty HTML Content</div>').replace(/{{\s*([\w.]+)\s*}}/g, (_match, path: string) => {
    const value = path.split('.').reduce<any>((current, key) => current?.[key], data);
    return escapeHtml(value);
  });
  return (
    <div
      className={`dynamic-html-container ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};
