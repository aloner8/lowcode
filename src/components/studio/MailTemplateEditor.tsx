'use client';

import React, { useMemo, useState } from 'react';
import { Eye, FilePlus2, Mail, Trash2 } from 'lucide-react';
import {
  isValidMailTemplateId,
  normalizeMailTemplates,
  removeMailTemplate,
  renderMailTemplatePreview,
  setMailTemplate,
  type MailTemplateMap,
} from '@/lib/services/mailBindingTemplates';

interface Props {
  value: unknown;
  onChange: (templates: MailTemplateMap) => void;
}

export const MailTemplateEditor: React.FC<Props> = ({ value, onChange }) => {
  const templates = useMemo(() => normalizeMailTemplates(value), [value]);
  const ids = Object.keys(templates).sort();
  const [selectedId, setSelectedId] = useState(ids[0] || '');
  const [newId, setNewId] = useState('');
  const [variablesText, setVariablesText] = useState('{\n  "name": "Artit"\n}');
  const [message, setMessage] = useState('');
  const activeId = templates[selectedId] ? selectedId : ids[0] || '';
  const active = activeId ? templates[activeId] : undefined;
  let variables: Record<string, unknown> = {};
  let variablesError = '';
  try {
    const parsed = JSON.parse(variablesText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Variables must be an object');
    variables = parsed as Record<string, unknown>;
  } catch (error) {
    variablesError = error instanceof Error ? error.message : 'Invalid variables JSON';
  }

  const addTemplate = () => {
    const id = newId.trim();
    if (!isValidMailTemplateId(id)) { setMessage('Template ID must start with a letter and use only letters, numbers, dot, underscore or dash'); return; }
    if (templates[id]) { setMessage(`Template '${id}' already exists`); return; }
    onChange(setMailTemplate(templates, id, { subject: `Message for {{name}}`, html: '<p>Hello {{name}}</p>' }));
    setSelectedId(id);
    setNewId('');
    setMessage('');
  };
  const updateActive = (patch: Partial<{ subject: string; html: string }>) => {
    if (!activeId || !active) return;
    onChange(setMailTemplate(templates, activeId, { ...active, ...patch }));
  };
  const removeActive = () => {
    if (!activeId) return;
    const next = removeMailTemplate(templates, activeId);
    onChange(next);
    setSelectedId(Object.keys(next).sort()[0] || '');
  };

  return <div className="border rounded-3 p-3 bg-light">
    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
      <div><div className="fw-bold d-flex align-items-center gap-1"><Mail size={15}/> Mail templates</div><div className="small text-muted">Templates are versioned with the binding. Runtime calls them by ID.</div></div>
      <span className="badge bg-primary-subtle text-primary">{ids.length} templates</span>
    </div>
    <div className="input-group input-group-sm mb-2">
      <input aria-label="New mail template ID" className="form-control font-monospace" value={newId} onChange={(event) => setNewId(event.target.value)} placeholder="welcome-email"/>
      <button type="button" className="btn btn-outline-primary" onClick={addTemplate}><FilePlus2 size={13}/> Add</button>
    </div>
    {message && <div role="alert" className="alert alert-warning py-1 px-2 small">{message}</div>}
    {ids.length > 0 ? <>
      <div className="d-flex gap-2 mb-2">
        <select aria-label="Mail template" className="form-select form-select-sm font-monospace" value={activeId} onChange={(event) => setSelectedId(event.target.value)}>{ids.map((id) => <option key={id} value={id}>{id}</option>)}</select>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeActive} aria-label="Delete mail template"><Trash2 size={13}/></button>
      </div>
      <label className="form-label small fw-semibold" htmlFor="mail-template-subject">Subject</label>
      <input id="mail-template-subject" className="form-control form-control-sm mb-2" value={active?.subject || ''} onChange={(event) => updateActive({ subject: event.target.value })}/>
      <label className="form-label small fw-semibold" htmlFor="mail-template-html">HTML body</label>
      <textarea id="mail-template-html" className="form-control form-control-sm font-monospace mb-2" rows={7} value={active?.html || ''} onChange={(event) => updateActive({ html: event.target.value })}/>
      <label className="form-label small fw-semibold" htmlFor="mail-template-variables">Preview variables (JSON)</label>
      <textarea id="mail-template-variables" className={`form-control form-control-sm font-monospace ${variablesError ? 'is-invalid' : ''}`} rows={4} value={variablesText} onChange={(event) => setVariablesText(event.target.value)}/>
      {variablesError && <div className="invalid-feedback">{variablesError}</div>}
      {!variablesError && <div className="border rounded-2 bg-white p-2 mt-2 small">
        <div className="fw-semibold d-flex align-items-center gap-1"><Eye size={13}/> Safe preview</div>
        <div className="mt-1"><strong>Subject:</strong> {renderMailTemplatePreview(active?.subject || '', variables)}</div>
        <pre className="mb-0 mt-1 text-wrap" data-testid="mail-html-preview">{renderMailTemplatePreview(active?.html || '', variables)}</pre>
      </div>}
    </> : <div className="small text-muted border rounded-2 bg-white p-3">Add at least one template before validating this binding.</div>}
  </div>;
};
