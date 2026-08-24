'use client';

import React from 'react';
import { ThemeConfig, ThemePreset } from '@/types';
import { THEME_PRESETS } from '@/components/shared/ThemeEngine';
import { Palette, Sun, Moon } from 'lucide-react';

interface ThemeCustomizerPanelProps {
  themeConfig: ThemeConfig;
  onChangeTheme: (updatedTheme: ThemeConfig) => void;
}

export const ThemeCustomizerPanel: React.FC<ThemeCustomizerPanelProps> = ({
  themeConfig,
  onChangeTheme,
}) => {
  const handlePresetChange = (presetKey: ThemePreset) => {
    const preset = THEME_PRESETS[presetKey];
    onChangeTheme({
      ...themeConfig,
      preset: presetKey,
      primaryColor: preset.primary,
      borderRadius: preset.borderRadius,
    });
  };

  return (
    <div className="d-flex align-items-center gap-2">
      {/* Preset Selector Dropdown */}
      <div className="d-flex align-items-center gap-1.5">
        <Palette size={14} className="text-primary" />
        <select
          className="form-select form-select-sm extra-small bg-light border-0 text-dark font-medium rounded-2 py-1 pe-4"
          style={{ fontSize: '0.75rem', width: 'auto' }}
          value={themeConfig.preset}
          onChange={(e) => handlePresetChange(e.target.value as ThemePreset)}
        >
          {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => (
            <option key={key} value={key}>
              Theme: {key}
            </option>
          ))}
        </select>
      </div>

      {/* Primary Color Picker */}
      <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-2 border border-light">
        <input
          type="color"
          className="form-control form-control-color p-0 border-0 bg-transparent rounded-circle cursor-pointer"
          style={{ width: '18px', height: '18px' }}
          value={themeConfig.primaryColor}
          onChange={(e) => onChangeTheme({ ...themeConfig, primaryColor: e.target.value })}
        />
        <span className="extra-small font-monospace text-secondary" style={{ fontSize: '0.68rem' }}>
          {themeConfig.primaryColor}
        </span>
      </div>

      {/* Light / Dark Mode Toggle */}
      <div className="btn-group btn-group-sm bg-light p-0.5 rounded-2 border border-light">
        <button
          className={`btn btn-sm py-0.5 px-2 rounded-1 border-0 extra-small ${
            themeConfig.mode === 'light' ? 'bg-white text-dark shadow-sm fw-bold' : 'text-secondary'
          }`}
          onClick={() => onChangeTheme({ ...themeConfig, mode: 'light' })}
          style={{ fontSize: '0.7rem' }}
        >
          <Sun size={12} />
        </button>
        <button
          className={`btn btn-sm py-0.5 px-2 rounded-1 border-0 extra-small ${
            themeConfig.mode === 'dark' ? 'bg-white text-dark shadow-sm fw-bold' : 'text-secondary'
          }`}
          onClick={() => onChangeTheme({ ...themeConfig, mode: 'dark' })}
          style={{ fontSize: '0.7rem' }}
        >
          <Moon size={12} />
        </button>
      </div>
    </div>
  );
};
