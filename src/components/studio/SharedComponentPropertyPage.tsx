'use client';

import React, { useState } from 'react';
import type { ComponentNode } from '@/types';
import { getSharedComponentPropertyDefinition, type SharedComponentPropertyField } from '@/lib/studio/sharedComponentPropertyRegistry';

interface Props { component: ComponentNode; onChange: (component: ComponentNode) => void }

export const SharedComponentPropertyPage: React.FC<Props> = ({ component, onChange }) => {
  const definition = getSharedComponentPropertyDefinition(component.type);
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const update = (key: string, value: unknown) => onChange({ ...component, props: { ...component.props, [key]: value } });
  const renderField = (property: SharedComponentPropertyField) => {
    const value = component.props?.[property.key] ?? property.defaultValue ?? '';
    if (property.editor === 'boolean') return <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={Boolean(value)} onChange={(event) => update(property.key, event.target.checked)}/><label className="form-check-label">{property.label}</label></div>;
    if (property.editor === 'select') return <><label className="form-label small fw-semibold">{property.label}</label><select className="form-select form-select-sm" value={String(value)} onChange={(event) => update(property.key, event.target.value)}><option value="">Select...</option>{property.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></>;
    if (property.editor === 'json') { const text = jsonDrafts[property.key] ?? JSON.stringify(value || [], null, 2); return <><label className="form-label small fw-semibold">{property.label}</label><textarea className="form-control form-control-sm font-monospace" rows={7} value={text} onChange={(event) => setJsonDrafts({ ...jsonDrafts, [property.key]: event.target.value })} onBlur={() => { try { update(property.key, JSON.parse(text)); } catch { window.alert(`${property.label} JSON ไม่ถูกต้อง`); } }}/></>; }
    if (property.editor === 'textarea') return <><label className="form-label small fw-semibold">{property.label}</label><textarea className="form-control form-control-sm font-monospace" rows={6} value={String(value)} placeholder={property.placeholder} onChange={(event) => update(property.key, event.target.value)}/></>;
    return <><label className="form-label small fw-semibold">{property.label}</label><input className="form-control form-control-sm" type={property.editor === 'number' ? 'number' : 'text'} value={String(value)} placeholder={property.placeholder} onChange={(event) => update(property.key, property.editor === 'number' ? Number(event.target.value) : event.target.value)}/></>;
  };
  return <div className="p-4"><div className="mb-4"><h5 className="mb-1">{definition.title}</h5><p className="text-muted small mb-0">{definition.description}</p></div><div className="row g-3">{definition.groups.map((group) => <div className="col-xl-6" key={group.id}><div className="border rounded-3 p-3 h-100"><h6 className="border-bottom pb-2 mb-3">{group.label}</h6><div className="d-flex flex-column gap-3">{group.fields.map((property) => <div key={property.key}>{renderField(property)}{property.description && <div className="form-text">{property.description}</div>}</div>)}</div></div></div>)}</div></div>;
};

