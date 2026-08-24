'use client';

import React, { useEffect, useState } from 'react';
import { FieldInputComponent, FieldInputProps } from './FieldInputComponent';

export interface FormComponentProps {
  id?: string;
  title?: string;
  description?: string;
  fields: FieldInputProps[];
  submitText?: string;
  resetText?: string;
  initialValues?: Record<string, any>;
  onSubmit?: (formData: Record<string, any>) => void;
  className?: string;
}

export const FormComponent: React.FC<FormComponentProps> = ({
  id,
  title,
  description,
  fields = [],
  submitText = 'Submit',
  resetText,
  initialValues = {},
  onSubmit,
  className = '',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  useEffect(() => { setFormData(initialValues); }, [initialValues]);

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const handleReset = () => {
    setFormData(initialValues);
  };

  return (
    <div className={`card shadow-sm border-0 bg-white p-4 ${className}`} id={id}>
      {title && <h4 className="card-title fw-bold mb-2">{title}</h4>}
      {description && <p className="card-subtitle text-muted mb-4">{description}</p>}

      <form onSubmit={handleSubmit}>
        {fields.map((field, idx) => (
          <FieldInputComponent
            key={field.name || idx}
            {...field}
            value={formData[field.name] ?? field.value ?? ''}
            onChange={handleFieldChange}
          />
        ))}

        <div className="d-flex gap-2 justify-content-end mt-4">
          {resetText && (
            <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>
              {resetText}
            </button>
          )}
          <button type="submit" className="btn btn-primary px-4">
            {submitText}
          </button>
        </div>
      </form>
    </div>
  );
};
