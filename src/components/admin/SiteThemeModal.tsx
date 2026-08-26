'use client';

import React, { useEffect, useState } from 'react';
import { Palette, Save, Sun, Moon } from 'lucide-react';
import { THEME_PRESETS } from '@/components/shared/ThemeEngine';
import type { ThemeConfig, ThemePreset } from '@/types';

interface SiteThemeModalProps {
  readonly isOpen: boolean;
  readonly siteName: string;
  readonly initialTheme: ThemeConfig;
  readonly isSaving?: boolean;
  readonly onClose: () => void;
  readonly onSave: (theme: ThemeConfig) => void;
}

const PRESET_LABELS: Record<ThemePreset, string> = {
  'thai-municipal': 'ราชการไทย (แดง–น้ำเงิน–ทอง)',
  'modern-indigo': 'Modern Indigo',
  'corporate-emerald': 'Corporate Emerald',
  'dark-glassmorphism': 'Dark Glassmorphism',
  'sunset-warm': 'Sunset Warm',
  cyberpunk: 'Cyberpunk',
  'minimal-slate': 'Minimal Slate',
};

const FONT_OPTIONS = [
  'Anuphan, sans-serif',
  'Inter, sans-serif',
  '"IBM Plex Sans Thai", sans-serif',
  '"Noto Sans Thai", sans-serif',
  '"Sarabun", sans-serif',
  '"Prompt", sans-serif',
  'system-ui, sans-serif',
];

const RADIUS_OPTIONS = [
  { value: '0rem', label: 'เหลี่ยม (0)' },
  { value: '0.25rem', label: 'มนเล็กน้อย (0.25rem)' },
  { value: '0.375rem', label: 'มาตรฐาน (0.375rem)' },
  { value: '0.5rem', label: 'มน (0.5rem)' },
  { value: '0.75rem', label: 'มนมาก (0.75rem)' },
  { value: '1rem', label: 'มนสุด (1rem)' },
];

/** Per-site theme picker. The saved config overrides the Platform Master theme. */
export default function SiteThemeModal({
  isOpen,
  siteName,
  initialTheme,
  isSaving = false,
  onClose,
  onSave,
}: SiteThemeModalProps) {
  const [theme, setTheme] = useState<ThemeConfig>(initialTheme);

  useEffect(() => {
    if (isOpen) setTheme(initialTheme);
  }, [isOpen, initialTheme]);

  if (!isOpen) return null;

  const update = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    setTheme((previous) => ({ ...previous, [key]: value }));

  /** Selecting a preset seeds colour and radius, which stay editable afterwards. */
  const applyPreset = (preset: ThemePreset) => {
    const definition = THEME_PRESETS[preset];
    setTheme((previous) => ({
      ...previous,
      preset,
      primaryColor: definition.primary,
      borderRadius: definition.borderRadius,
      mode: preset === 'dark-glassmorphism' || preset === 'cyberpunk' ? 'dark' : 'light',
    }));
  };

  return (
    <div className="modal d-block" style={{ background: 'rgba(15,23,42,0.6)', zIndex: 1050 }} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow rounded-3">
          <div className="modal-header">
            <h6 className="modal-title fw-bold d-flex align-items-center gap-2">
              <Palette size={18} className="text-primary" /> ธีมของ {siteName}
            </h6>
            <button type="button" className="btn-close" onClick={onClose} aria-label="ปิด" />
          </div>

          <div className="modal-body">
            <div className="mb-4">
              <span className="form-label small fw-semibold d-block">Theme Preset</span>
              <div className="row g-2">
                {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((preset) => {
                  const definition = THEME_PRESETS[preset];
                  const isSelected = theme.preset === preset;
                  return (
                    <div className="col-6 col-md-4" key={preset}>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        aria-pressed={isSelected}
                        className={`btn w-100 text-start p-2 rounded-3 border ${
                          isSelected ? 'border-primary border-2 shadow-sm' : 'border-light'
                        }`}
                        style={{ background: definition.background }}
                      >
                        <span
                          className="d-inline-block rounded-circle mb-1"
                          style={{ width: 18, height: 18, background: definition.primary }}
                        />
                        <span className="d-block extra-small fw-semibold text-dark">
                          {PRESET_LABELS[preset]}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="primaryColor" className="form-label small fw-semibold">สีหลัก (Primary)</label>
                <div className="input-group">
                  <input
                    id="primaryColor"
                    type="color"
                    className="form-control form-control-color"
                    value={theme.primaryColor}
                    onChange={(event) => update('primaryColor', event.target.value)}
                  />
                  <input
                    className="form-control font-monospace"
                    value={theme.primaryColor}
                    onChange={(event) => update('primaryColor', event.target.value)}
                    aria-label="รหัสสีหลัก"
                  />
                </div>
              </div>

              <div className="col-md-6">
                <span className="form-label small fw-semibold d-block">โหมดสี</span>
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm ${theme.mode === 'light' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => update('mode', 'light')}
                  >
                    <Sun size={14} className="me-1" /> Light
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${theme.mode === 'dark' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => update('mode', 'dark')}
                  >
                    <Moon size={14} className="me-1" /> Dark
                  </button>
                </div>
              </div>

              <div className="col-md-6">
                <label htmlFor="borderRadius" className="form-label small fw-semibold">ความมนของมุม</label>
                <select
                  id="borderRadius"
                  className="form-select"
                  value={theme.borderRadius}
                  onChange={(event) => update('borderRadius', event.target.value)}
                >
                  {RADIUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label htmlFor="fontFamily" className="form-label small fw-semibold">ฟอนต์</label>
                <select
                  id="fontFamily"
                  className="form-select"
                  value={theme.fontFamily}
                  onChange={(event) => update('fontFamily', event.target.value)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live preview using the values above */}
            <div
              className="mt-4 p-3 rounded-3 border"
              style={{
                background: theme.mode === 'dark' ? '#0f172a' : '#ffffff',
                color: theme.mode === 'dark' ? '#e2e8f0' : '#0f172a',
                fontFamily: theme.fontFamily,
                borderRadius: theme.borderRadius,
              }}
            >
              <div className="small fw-semibold mb-2">ตัวอย่างการแสดงผล</div>
              <button
                type="button"
                className="btn btn-sm text-white me-2"
                style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}
              >
                ปุ่มหลัก
              </button>
              <span
                className="badge"
                style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}
              >
                Badge
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose}>ยกเลิก</button>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2"
              disabled={isSaving}
              onClick={() => onSave(theme)}
            >
              <Save size={16} /> {isSaving ? 'กำลังบันทึก…' : 'บันทึกธีม'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
