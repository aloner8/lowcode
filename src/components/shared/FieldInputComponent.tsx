'use client';

import React, { useMemo, useState } from 'react';
import { HtmlEditorComponent } from './HtmlEditorComponent';
import { FileManagerPopupComponent, type FileManagerAsset } from './FileManagerPopupComponent';
import { FileText, FolderOpen, X } from 'lucide-react';

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
  fileManagerRootPath?: string;
  fileManagerPath?: string;
  imageFileManagerPath?: string;
  documentFileManagerPath?: string;
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
  fileManagerRootPath = '/uploads',
  fileManagerPath = '/uploads',
  imageFileManagerPath,
  documentFileManagerPath,
  onChange,
  className = '',
}) => {
  const inputId = id || `field_${name}`;
  const [showFileManager, setShowFileManager] = useState(false);
  const [currentPath, setCurrentPath] = useState(fileManagerPath);
  const selectedAssets = useMemo<FileManagerAsset[]>(() => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.map((item, index) => typeof item === 'string'
      ? { id: `${name}-${index}-${item}`, name: decodeURIComponent(item.split('/').pop() || item), path: item, url: item }
      : item as FileManagerAsset);
  }, [name, value]);

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
          fileManagerRootPath={fileManagerRootPath}
          imageFileManagerPath={imageFileManagerPath || fileManagerPath}
          documentFileManagerPath={documentFileManagerPath || fileManagerPath}
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
        <>
          <button id={inputId} name={name} type="button" className={`form-control text-start d-flex align-items-center gap-2 ${error ? 'is-invalid' : ''}`} disabled={disabled} onClick={() => setShowFileManager(true)}>
            <FolderOpen size={17} className="text-primary"/>
            <span className={selectedAssets.length ? 'text-dark' : 'text-muted'}>{selectedAssets.length ? type === 'multi-file' ? `เลือกแล้ว ${selectedAssets.length} ไฟล์` : selectedAssets[0].name : 'เลือกจาก File Manager'}</span>
          </button>
          {selectedAssets.length > 0 && <div className="d-flex flex-wrap gap-2 mt-2">{selectedAssets.map((asset) => <div key={asset.id} className="border rounded-2 p-1 d-flex align-items-center gap-2 bg-light" style={{ maxWidth: 240 }}>
            {/\.(png|jpe?g|gif|webp|svg)$/i.test(asset.name) ? <img src={asset.url} alt={asset.name} style={{ width: 42, height: 42, objectFit: 'cover' }} className="rounded"/> : <FileText size={28} className="text-secondary"/>}
            <span className="small text-truncate flex-grow-1">{asset.name}</span>
            {!disabled && <button type="button" className="btn btn-sm border-0 p-1" onClick={() => { const next = selectedAssets.filter((item) => item.id !== asset.id); onChange?.(name, type === 'multi-file' ? next.map((item) => item.url) : ''); }}><X size={12}/></button>}
          </div>)}</div>}
          <FileManagerPopupComponent open={showFileManager} title={`เลือก ${label || 'ไฟล์'}`} rootPath={fileManagerRootPath} currentPath={currentPath} selectionMode={type === 'multi-file' ? 'multiple' : 'single'} accept={accept || '*/*'} onCurrentPathChange={setCurrentPath} onUse={(assets) => { onChange?.(name, type === 'multi-file' ? assets.map((asset) => asset.url) : assets[0]?.url || ''); setShowFileManager(false); }} onClose={() => setShowFileManager(false)}/>
        </>
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
