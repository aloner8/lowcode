'use client';

import React from 'react';
import { HtmlEditorComponent } from '@/components/shared/HtmlEditorComponent';

interface StudioHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export const StudioHtmlEditor: React.FC<StudioHtmlEditorProps> = ({ value, onChange }) => {
  return (
    <HtmlEditorComponent
      label="HTML Studio Editor"
      initialContent={value}
      onChange={onChange}
    />
  );
};

