'use client';

import React from 'react';

export interface FieldInputProps {
  id?: string;
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'select' | 'checkbox' | 'radio' | 'textarea';
  value?: any;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>; // For select / radio
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
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
      {label && type !== 'checkbox' && (
        <label htmlFor={inputId} className="form-label fw-semibold">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      {type === 'textarea' ? (
        <textarea
          id={inputId}
          name={name}
          className={`form-control ${error ? 'is-invalid' : ''}`}
          placeholder={placeholder}
          value={value}
          required={required}
          disabled={disabled}
          onChange={handleChange}
          rows={3}
        />
      ) : type === 'select' ? (
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
      ) : type === 'checkbox' ? (
        <div className="form-check">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            className={`form-check-input ${error ? 'is-invalid' : ''}`}
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
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
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
