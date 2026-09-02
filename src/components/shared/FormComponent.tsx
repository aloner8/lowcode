'use client';

import React, { useEffect, useState } from 'react';
import { FieldInputComponent, FieldInputProps } from './FieldInputComponent';

// A default object created in the function parameter is a new reference on
// every render. That made the initialValues effect clear controlled fields
// after every keystroke on forms that do not provide initialValues (login).
const EMPTY_FORM_VALUES: Record<string, any> = Object.freeze({});

export interface FormComponentProps {
  id?: string;
  formId?: string;
  collectionId?: string;
  title?: string;
  description?: string;
  fields: FieldInputProps[];
  submitText?: string;
  resetText?: string;
  initialValues?: Record<string, any>;
  requestContract?: Array<Record<string, any>>;
  responseContract?: Array<Record<string, any>>;
  requestBindings?: Record<string, string>;
  responseBindings?: Record<string, string>;
  operationBindings?: Record<string, string>;
  requestValues?: Record<string, any>;
  onSubmit?: (
    formData: Record<string, any>,
    requestValues?: Record<string, any>,
  ) => unknown | Promise<unknown>;
  onOperation?: (
    operationId: string,
    formData: Record<string, any>,
    requestValues?: Record<string, any>,
  ) => unknown | Promise<unknown>;
  onResponse?: (response: {
    formData: Record<string, any>;
    submitResult: unknown;
    outputs: Record<string, unknown>;
  }) => void;
  className?: string;
  mode?: 'insert' | 'update' | 'readOnly';
}

export const FormComponent: React.FC<FormComponentProps> = ({
  id,
  formId,
  collectionId,
  title,
  description,
  fields = [],
  submitText = 'Submit',
  resetText,
  initialValues = EMPTY_FORM_VALUES,
  onSubmit,
  onOperation,
  onResponse,
  requestValues = EMPTY_FORM_VALUES,
  responseBindings = EMPTY_FORM_VALUES,
  operationBindings = EMPTY_FORM_VALUES,
  className = '',
  mode = 'insert',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  useEffect(() => { setFormData(initialValues); }, [initialValues]);

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const operationId = mode === 'update'
      ? operationBindings.update || operationBindings.save || operationBindings.submit
      : operationBindings.submit || operationBindings.save || operationBindings.create;
    const submitResult = operationId && onOperation
      ? await onOperation(operationId, formData, requestValues)
      : onSubmit ? await onSubmit(formData, requestValues) : undefined;
    const standardOutputs: Record<string, unknown> = {
      formData,
      submitResult,
    };
    const outputs = Object.fromEntries(
      Object.entries(responseBindings).map(([outputKey, sourceKey]) => [
        outputKey,
        standardOutputs[String(sourceKey)],
      ]),
    );
    onResponse?.({
      formData,
      submitResult,
      outputs: Object.keys(outputs).length ? outputs : standardOutputs,
    });
  };

  const handleReset = () => {
    setFormData(initialValues);
  };

  const uploadPathFor = (field: FieldInputProps) => {
    if (field.fileManagerPath) return field.fileManagerPath;
    const collection = collectionId || formId?.replace(/\.form$/, '.collection') || '';
    const exact: Record<string, Record<string, string>> = {
      'cms.post.collection': { files: '/uploads/file_folder', gallery: '/uploads/gallery' },
      'cms.personnel.collection': { photo: '/uploads/personnel' },
      'cms.slide.collection': { slide: '/uploads/slides' },
      'cms.banner-slide.collection': { image: '/uploads/banners', imageFile: '/uploads/banners' },
      'cms.file.collection': { files: '/uploads/file_download' },
      'cms.ebook.collection': { cover: '/uploads/ebook/cover', ebook_file: '/uploads/ebook/pdf' },
      'cms.homepage-highlight.collection': { left_image: '/uploads/nayok-palad', right_image: '/uploads/nayok-palad' },
      'cms.generalhelp.collection': { imgcard: '/uploads/helppeople', imgadd: '/uploads/helppeople', imgpic: '/uploads/helppeople', imgdoc: '/uploads/helppeople', files: '/uploads/helppeople' },
      'cms.oldage.collection': { card_copy: '/uploads/oldage', add_copy: '/uploads/oldage', bank_copy: '/uploads/oldage', files: '/uploads/oldage' },
      'cms.usewater.collection': { card_copy: '/uploads/usewater', files: '/uploads/usewater' },
      'cms.electric.collection': { map: '/uploads/electric', files: '/uploads/electric' },
      'cms.getbin.collection': { map: '/uploads/getbin', files: '/uploads/getbin' },
      'smartreport.ticket.collection': { images: '/uploads/smartreport', files: '/uploads/smartreport' },
    };
    return exact[collection]?.[field.name] || `/uploads/${collection.replace(/\.collection$/, '').replace(/\./g, '/') || 'files'}`;
  };
  const editorPathsFor = (field: FieldInputProps) => {
    const collection = collectionId || formId?.replace(/\.form$/, '.collection') || '';
    if (collection === 'cms.post.collection') return { imageFileManagerPath: '/uploads/gallery', documentFileManagerPath: '/uploads/file_folder' };
    if (collection === 'cms.page.collection') return { imageFileManagerPath: '/uploads/images', documentFileManagerPath: '/uploads/files' };
    return { imageFileManagerPath: uploadPathFor(field), documentFileManagerPath: uploadPathFor(field) };
  };

  return (
    <div className={`card municipal-admin-form shadow-sm border bg-white p-4 ${className}`} id={id}>
      {title && <h4 className="card-title fw-bold mb-2">{title}</h4>}
      {description && <p className="card-subtitle text-muted mb-4">{description}</p>}

      <form onSubmit={handleSubmit}>
        {fields.map((field, idx) => (
          <FieldInputComponent
            key={field.name || idx}
            {...field}
            disabled={mode === 'readOnly' || field.disabled}
            fileManagerPath={uploadPathFor(field)}
            {...(field.type === 'html-editor' ? editorPathsFor(field) : {})}
            value={formData[field.name] ?? field.value ?? ''}
            onChange={handleFieldChange}
          />
        ))}

        {mode !== 'readOnly' && <div className="d-flex gap-2 justify-content-end mt-4">
          {resetText && (
            <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>
              {resetText}
            </button>
          )}
          <button type="submit" className="btn btn-primary px-4">
            {submitText}
          </button>
        </div>}
      </form>
    </div>
  );
};
