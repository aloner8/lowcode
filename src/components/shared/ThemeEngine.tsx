'use client';

import React, { useEffect } from 'react';
import { ThemeConfig, ThemePreset } from '@/types';

export const THEME_PRESETS: Record<ThemePreset, { primary: string; background: string; borderRadius: string }> = {
  /* เว็บราชการไทย — CI แดง/น้ำเงิน + ทอง ตามแบบ pathum.go.th */
  'thai-municipal': {
    primary: '#D91113',
    background: '#F7F9FC',
    borderRadius: '16px',
  },
  'modern-indigo': {
    primary: '#4f46e5',
    background: '#f8fafc',
    borderRadius: '0.5rem',
  },
  'corporate-emerald': {
    primary: '#10b981',
    background: '#f0fdf4',
    borderRadius: '0.375rem',
  },
  'dark-glassmorphism': {
    primary: '#6366f1',
    background: '#0f172a',
    borderRadius: '0.75rem',
  },
  'sunset-warm': {
    primary: '#f97316',
    background: '#fff7ed',
    borderRadius: '0.5rem',
  },
  cyberpunk: {
    primary: '#06b6d4',
    background: '#18181b',
    borderRadius: '0rem',
  },
  'minimal-slate': {
    primary: '#475569',
    background: '#f1f5f9',
    borderRadius: '0.25rem',
  },
};

interface ThemeEngineProps {
  themeConfig?: ThemeConfig;
  children: React.ReactNode;
}

export const ThemeEngine: React.FC<ThemeEngineProps> = ({ themeConfig, children }) => {
  useEffect(() => {
    if (!themeConfig) return;

    const root = document.documentElement;
    const preset = THEME_PRESETS[themeConfig.preset] || THEME_PRESETS['modern-indigo'];

    const primary = themeConfig.primaryColor || preset.primary;
    const radius = themeConfig.borderRadius || preset.borderRadius;
    const isDark = themeConfig.mode === 'dark';

    // Apply Bootstrap 5 & Custom CSS Variables
    root.style.setProperty('--bs-primary', primary);
    root.style.setProperty('--bs-border-radius', radius);
    root.style.setProperty('--font-sans', themeConfig.fontFamily || 'Anuphan, sans-serif');

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      root.style.setProperty('--background', '#0f172a');
      root.style.setProperty('--foreground', '#f8fafc');
      root.style.setProperty('--bs-body-bg', '#0f172a');
      root.style.setProperty('--bs-body-color', '#f8fafc');
    } else {
      root.removeAttribute('data-theme');
      root.style.setProperty('--background', preset.background);
      root.style.setProperty('--foreground', '#0f172a');
      root.style.setProperty('--bs-body-bg', preset.background);
      root.style.setProperty('--bs-body-color', '#0f172a');
    }

    // Apply custom variables if provided
    if (themeConfig.customVariables) {
      Object.entries(themeConfig.customVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }, [themeConfig]);

  return <div className="theme-provider">{children}</div>;
};
