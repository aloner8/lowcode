'use client';

import React from 'react';
import { HtmlEditorComponent } from './HtmlEditorComponent';

export interface FieldInputProps {
  id?: string;
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'datetime' | 'select' | 'collection-select' | 'checkbox' | 'switch' | 'radio' | 'textarea' | 'html-editor' | 'file' | 'multi-file' | 'tags' | 'color';
  value?: any;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>; // For select / radio
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  accept?: string;
  rows?: number;
  onChange?: (name: string, value: any) => void;
  className?: string;
}

export const FieldInputComponent: React.FC<FieldInputProps> = ({
  id,
  name,
  label,
  type = 'text',
  value = '',
  placeholder = '',
  options = [],
  required = false,
  disabled = false,
  error,
  helpText,
  accept,
  rows = 4,
  onChange,
  className = '',
}) => {
  const inputId = id || `field_${name}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!onChange) return;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      onChange(name, target.checked);
    } else {
      onChange(name, e.target.value);
    }
  };

  return (
    <div className={`mb-3 ${className}`}>
      {label && type !== 'checkbox' && type !== 'switch' && type !== 'html-editor' && (
        <label htmlFor={inputId} className="form-label fw-semibold">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      {type === 'html-editor' ? (
        <HtmlEditorComponent
          label={label || 'HTML Editor'}
          initialContent={typeof value === 'string' ? value : ''}
          onChange={(html) => onChange?.(name, html)}
          readOnly={disabled}
        />
      ) : type === 'textarea' ? (
        <textarea
          id={inputId}
          name={name}
          className={`form-control ${error ? 'is-invalid' : ''}`}
          placeholder={placeholder}
          value={value}
          required={required}
          disabled={disabled}
          onChange={handleChange}
          rows={rows}
        />
      ) : type === 'select' || type === 'collection-select' ? (
        <select
          id={inputId}
          name={name}
          className={`form-select ${error ? 'is-invalid' : ''}`}
          value={value}
          required={required}
          disabled={disabled}
          onChange={handleChange}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'checkbox' || type === 'switch' ? (
        <div className="form-check">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            className={`form-check-input ${type === 'switch' ? 'cursor-pointer' : ''} ${error ? 'is-invalid' : ''}`}
            role={type === 'switch' ? 'switch' : undefined}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={handleChange}
          />
          {label && (
            <label className="form-check-label" htmlFor={inputId}>
              {label} {required && <span className="text-danger">*</span>}
            </label>
          )}
        </div>
      ) : type === 'radio' ? (
        <div>
          {options.map((opt, idx) => (
            <div className="form-check form-check-inline" key={idx}>
              <input
                id={`${inputId}_${idx}`}
                name={name}
                type="radio"
                className="form-check-input"
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor={`${inputId}_${idx}`}>
                {opt.label}
              </label>
            </div>
          ))}
        </div>
      ) : type === 'file' || type === 'multi-file' ? (
        <input
          id={inputId}
          name={name}
          type="file"
          className={`form-control ${error ? 'is-invalid' : ''}`}
          accept={accept}
          multiple={type === 'multi-file'}
          required={required}
          disabled={disabled}
          onChange={(event) => onChange?.(name, type === 'multi-file' ? Array.from(event.target.files || []) : event.target.files?.[0] || null)}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          type={type === 'datetime' ? 'datetime-local' : type === 'tags' ? 'text' : type}
          className={`form-control ${error ? 'is-invalid' : ''}`}
          placeholder={placeholder}
          value={value}
          required={required}
          disabled={disabled}
          onChange={handleChange}
        />
      )}

      {helpText && !error && <div className="form-text text-muted">{helpText}</div>}
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  );
};
