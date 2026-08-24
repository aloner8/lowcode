'use client';

import React, { useState } from 'react';
import {
  ThemeEngine,
  THEME_PRESETS,
  FieldInputComponent,
  FormComponent,
  TableDataComponent,
  GalleryComponent,
  FileManagerComponent,
  DynamicHtmlComponent,
  HtmlEditorComponent,
  NavMenuComponent,
  SlideMenuComponent,
} from '@/components/shared';
import { ThemeConfig, ThemePreset } from '@/types';
import { Palette, CheckCircle, Eye } from 'lucide-react';

export default function SharedDemoPage() {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>({
    preset: 'modern-indigo',
    mode: 'light',
    primaryColor: '#4f46e5',
    borderRadius: '0.5rem',
    fontFamily: 'Inter, sans-serif',
  });

  const handleThemeChange = (presetKey: ThemePreset) => {
    const preset = THEME_PRESETS[presetKey];
    setCurrentTheme({
      preset: presetKey,
      mode: currentTheme.mode,
      primaryColor: preset.primary,
      borderRadius: preset.borderRadius,
      fontFamily: 'Inter, sans-serif',
    });
  };

  const sampleTableColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (row: any) => (
        <span className={`badge ${row.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
          {row.status}
        </span>
      ),
    },
  ];

  const sampleTableData = [
    { id: 'USR-01', name: 'Somchai Prasert', role: 'System Admin', status: 'Active' },
    { id: 'USR-02', name: 'Nirat Saisaeng', role: 'Lead Developer', status: 'Active' },
    { id: 'USR-03', name: 'Ananda Sukhum', role: 'Designer', status: 'Inactive' },
    { id: 'USR-04', name: 'Kanya Wattana', role: 'Product Manager', status: 'Active' },
  ];

  const sampleGalleryItems = [
    {
      id: 'g1',
      title: 'Modern Dashboard UI',
      category: 'UI Layout',
      imageUrl: 'https://picsum.photos/400/250?random=1',
      description: 'Responsive dashboard UI component with real-time charts.',
    },
    {
      id: 'g2',
      title: 'User Profile Form',
      category: 'Form',
      imageUrl: 'https://picsum.photos/400/250?random=2',
      description: 'Bootstrap 5 user profile settings form with validation.',
    },
    {
      id: 'g3',
      title: 'Data Grid Table',
      category: 'Table',
      imageUrl: 'https://picsum.photos/400/250?random=3',
      description: 'High performance data table with sorting and filtering.',
    },
  ];

  return (
    <ThemeEngine themeConfig={currentTheme}>
      <div className="min-vh-100 py-4">
        <div className="container">
          {/* Top Bar Navigation Component */}
          <NavMenuComponent
            brandName="Low-Code Shared Library"
            actions={
              <span className="badge bg-light text-dark px-3 py-2">
                <CheckCircle size={14} className="text-success me-1" /> 9 Components Built
              </span>
            }
          />

          {/* Theme Customizer Control Panel */}
          <div className="card shadow-sm border-0 p-4 mb-5 bg-white">
            <div className="d-flex align-items-center mb-3">
              <Palette className="text-primary me-2" size={24} />
              <h5 className="fw-bold mb-0">Multi-Theme Engine Live Customizer</h5>
            </div>

            <div className="row g-3 align-items-center">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Select Theme Preset:</label>
                <div className="d-flex gap-2 flex-wrap">
                  {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => (
                    <button
                      key={key}
                      className={`btn btn-sm ${
                        currentTheme.preset === key ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                      onClick={() => handleThemeChange(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label small fw-semibold text-muted">Mode:</label>
                <div className="btn-group btn-group-sm w-100">
                  <button
                    className={`btn ${currentTheme.mode === 'light' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCurrentTheme({ ...currentTheme, mode: 'light' })}
                  >
                    Light
                  </button>
                  <button
                    className={`btn ${currentTheme.mode === 'dark' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCurrentTheme({ ...currentTheme, mode: 'dark' })}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label small fw-semibold text-muted">Border Radius:</label>
                <select
                  className="form-select form-select-sm"
                  value={currentTheme.borderRadius}
                  onChange={(e) => setCurrentTheme({ ...currentTheme, borderRadius: e.target.value })}
                >
                  <option value="0rem">Square (0px)</option>
                  <option value="0.375rem">Rounded (6px)</option>
                  <option value="0.75rem">Extra Rounded (12px)</option>
                  <option value="1.5rem">Pill (24px)</option>
                </select>
              </div>
            </div>
          </div>

          <h3 className="fw-bold mb-4">Displaying all 9 Shared Components</h3>

          {/* Layout Grid showcasing components */}
          <div className="row g-4 mb-4">
            {/* Sidebar Slide Menu */}
            <div className="col-md-3">
              <SlideMenuComponent title="Navigation Menu" />
            </div>

            {/* Main Content Showcase */}
            <div className="col-md-9">
              <div className="d-flex flex-column gap-4">
                {/* 1. Form Component & Field Inputs */}
                <FormComponent
                  title="FormComponent & FieldInputComponent Demo"
                  description="Standard form layout using Bootstrap 5 controls"
                  fields={[
                    { name: 'username', label: 'User Name', placeholder: 'Enter username...', required: true },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'user@example.com' },
                    {
                      name: 'department',
                      label: 'Department',
                      type: 'select',
                      options: [
                        { label: 'Engineering', value: 'eng' },
                        { label: 'Marketing', value: 'mkt' },
                        { label: 'Human Resources', value: 'hr' },
                      ],
                    },
                    { name: 'agree', label: 'I accept terms & conditions', type: 'checkbox' },
                  ]}
                  submitText="Save Config"
                  onSubmit={(data) => alert('Form Submitted: ' + JSON.stringify(data, null, 2))}
                />

                {/* 2. Table Data Component */}
                <TableDataComponent
                  title="TableDataComponent Demo"
                  columns={sampleTableColumns}
                  data={sampleTableData}
                  actions={[
                    { label: 'Edit', variant: 'outline-primary', onClick: (row) => alert('Edit ' + row.name) },
                  ]}
                />

                {/* 3. Gallery Component */}
                <GalleryComponent title="GalleryComponent Demo" items={sampleGalleryItems} columns={3} />

                {/* 4. File Manager Component */}
                <FileManagerComponent title="FileManagerComponent Demo" />

                {/* 5. Dynamic HTML & HTML Editor */}
                <HtmlEditorComponent label="HtmlEditorComponent & DynamicHtmlComponent Demo" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeEngine>
  );
}
