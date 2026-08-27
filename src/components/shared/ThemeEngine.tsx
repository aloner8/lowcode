'use client';

import React, { useEffect, useMemo } from 'react';
import { ThemeConfig, ThemePreset } from '@/types';
import { buildGovPalette } from '@/lib/theme/palette';

export const THEME_PRESETS: Record<
  ThemePreset,
  { primary: string; secondary?: string; background: string; borderRadius: string }
> = {
  /* เว็บราชการไทย — CI แดง/น้ำเงิน + ทอง ตามแบบ pathum.go.th */
  'thai-municipal': {
    primary: '#D91113',
    secondary: '#063B7A',
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
  const preset = THEME_PRESETS[themeConfig?.preset as ThemePreset] || THEME_PRESETS['modern-indigo'];

  /*
   * Rendered as an inline style rather than set from the effect below, so the
   * colours are already in the server-rendered HTML. Applied only from the
   * effect, every page would paint in the fallback palette first and then
   * repaint — a visible flash of the wrong colours on every load.
   */
  const palette = useMemo(
    () => buildGovPalette({
      primary: themeConfig?.primaryColor || preset.primary,
      secondary: themeConfig?.secondaryColor || preset.secondary,
    }),
    [themeConfig?.primaryColor, themeConfig?.secondaryColor, preset],
  );

  useEffect(() => {
    if (!themeConfig) return;

    const root = document.documentElement;

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

  return (
    <div className="theme-provider" style={palette as React.CSSProperties}>
      {children}
    </div>
  );
};
