'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Save, Server, ShieldAlert } from 'lucide-react';
import { listServiceDefinitions } from '@/lib/services/catalog';
import { normalizeServiceBinding } from '@/lib/services/bindings';
import type { JsonSchema, SharedServiceDefinition, StudioServiceDefinition } from '@/types';
import { MailTemplateEditor } from './MailTemplateEditor';

interface Props { platformId: string; appId?: string | null; services: StudioServiceDefinition[]; collections: Array<{ id: string; name: string; table: string }>; onSave: (service: StudioServiceDefinition) => Promise<void> }

const providerFor = (kind: SharedServiceDefinition['kind']): StudioServiceDefinition['provider'] => kind === 'auth' ? 'jwt' : kind === 'data' ? 'postgres' : kind === 'storage' ? 'tenant-storage' : 'http-email';
const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, '.').replace(/^\.|\.$/g, '').toLowerCase();

function editor(schema: JsonSchema, value: unknown, set: (value: unknown) => void, key: string, collections: Props['collections']) {
  if (key === 'table') return <select className="form-select form-select-sm" value={String(value || '')} onChange={(event) => set(event.target.value)}><option value="">Select collection table...</option>{collections.map((item) => <option key={item.id} value={item.table}>{item.name} · {item.table}</option>)}</select>;
  if (schema.enum) return <select className="form-select form-select-sm" value={String(value ?? '')} onChange={(event) => set(event.target.value)}>{schema.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>;
  if (schema.type === 'boolean') return <input type="checkbox" className="form-check-input" checked={Boolean(value)} onChange={(event) => set(event.target.checked)}/>;
  if (schema.type === 'integer' || schema.type === 'number') return <input type="number" className="form-control form-control-sm" min={schema.minimum} max={schema.maximum} value={Number(value ?? 0)} onChange={(event) => set(Number(event.target.value))}/>;
  if (schema.type === 'array') return <input className="form-control form-control-sm" value={Array.isArray(value) ? value.join(', ') : ''} onChange={(event) => set(event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="comma separated"/>;
  if (schema.type === 'object') return <textarea className="form-control form-control-sm font-monospace" rows={4} value={JSON.stringify(value || {}, null, 2)} onChange={(event) => { try { set(JSON.parse(event.target.value)); } catch { /* keep last valid JSON */ } }}/>;
  return <input className="form-control form-control-sm" value={String(value ?? '')} onChange={(event) => set(event.target.value)}/>;
}

export const SharedServiceManager: React.FC<Props> = ({ platformId, appId, services, collections, onSave }) => {
  const catalog = useMemo(() => listServiceDefinitions(), []); const [availableServices, setAvailableServices] = useState(services); const [selectedId, setSelectedId] = useState(services[0]?.id || '');
  const selectedSource = availableServices.find((item) => item.id === selectedId); const [draft, setDraft] = useState<StudioServiceDefinition | null>(selectedSource ? normalizeServiceBinding(selectedSource) : null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!appId) { Promise.resolve().then(() => setAvailableServices(services)); return; }
    let cancelled = false;
    void fetch(`/api/apps/${appId}/service-bindings`, { cache: 'no-store' }).then((response) => response.json()).then((data: { services?: StudioServiceDefinition[] }) => { if (!cancelled && data.services) { setAvailableServices(data.services); const first = data.services[0]; if (first) { setSelectedId(first.id); setDraft(normalizeServiceBinding(first)); } } }).catch(() => { if (!cancelled) setStatus('Unable to load App binding overrides'); });
    return () => { cancelled = true; };
  }, [appId, services]);
  const definition = draft ? catalog.find((item) => item.serviceKey === draft.serviceRef?.serviceKey) : undefined;
  const add = (item: SharedServiceDefinition) => {
    const count = availableServices.filter((entry) => entry.serviceRef?.serviceKey === item.serviceKey).length + 1; const id = `app.${slug(item.serviceKey)}${count > 1 ? `.${count}` : ''}`;
    const secretRefs: Record<string, string> = item.kind === 'auth'
      ? { signingKey: 'env://PLATFORM_JWT_SECRET' }
      : item.serviceKey === 'notification.email'
        ? { smtpUsername: 'env://LOWCODE_CONNECTION_SMTP_USERNAME', smtpPassword: 'env://LOWCODE_CONNECTION_SMTP_PASSWORD' }
        : {};
    const config = item.serviceKey === 'notification.email'
      ? { ...item.defaultConfig, templates: {} }
      : { ...item.defaultConfig };
    const next: StudioServiceDefinition = { id, name: item.displayName, kind: item.kind, serviceRef: { serviceKey: item.serviceKey, version: item.version }, provider: providerFor(item.kind), scope: 'app', enabled: true, config, secretRefs, policy: { allowedOperations: Object.keys(item.operations) }, status: 'draft', containerBindings: [] };
    setSelectedId(id); setDraft(next); setStatus('New draft — configure and save');
  };
  const save = async () => {
    if (!draft) return; setStatus('Validating...');
    const response = await fetch(appId ? `/api/apps/${appId}/service-bindings` : `/api/platforms/${platformId}/service-bindings/validate`, { method: appId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    const result = await response.json() as { valid?: boolean; errors?: string[]; binding?: StudioServiceDefinition };
    if (!result.valid || !result.binding) { setStatus(`Invalid: ${(result.errors || []).join(' · ')}`); setDraft((current) => current ? { ...current, status: 'invalid', validationErrors: result.errors } : current); return; }
    if (!appId) await onSave(result.binding); const saved = appId ? { ...result.binding, scope: 'app' as const, status: 'published' as const } : result.binding; setAvailableServices((current) => [...current.filter((item) => item.id !== saved.id), saved]); setDraft(saved); setSelectedId(saved.id); setStatus(appId ? 'App override published' : 'Saved and valid — publish Runtime to activate');
  };
  return <div className="row g-3">
    <div className="col-lg-4"><div className="card border h-100"><div className="card-header fw-bold d-flex align-items-center gap-2"><Server size={16}/>{appId ? 'App Service Overrides' : 'Platform Service Bindings'}</div><div className="list-group list-group-flush">{availableServices.map((item) => <button key={item.id} className={`list-group-item list-group-item-action text-start ${selectedId === item.id ? 'active' : ''}`} onClick={() => { setSelectedId(item.id); setDraft(normalizeServiceBinding(item)); setStatus(''); }}><div className="fw-semibold">{item.name}</div><small>{item.id} · {item.status || 'legacy'}</small></button>)}</div><div className="card-body border-top"><div className="small fw-bold mb-2">Service Catalog</div><div className="d-grid gap-2">{catalog.map((item) => <button key={item.serviceKey} className="btn btn-sm btn-outline-primary text-start" onClick={() => add(item)}><Plus size={12}/> {item.displayName} <small className="text-muted">@{item.version}</small></button>)}</div></div></div></div>
    <div className="col-lg-8">{draft && definition ? <div className="card border"><div className="card-header bg-white d-flex justify-content-between align-items-center"><div><b>{draft.name}</b><div className="small text-muted">{definition.serviceKey}@{definition.version}</div></div><span className={`badge ${draft.status === 'invalid' ? 'bg-danger' : draft.status === 'valid' ? 'bg-success' : 'bg-warning text-dark'}`}>{draft.status || 'draft'}</span></div><div className="card-body">
      <div className="row g-3 mb-3"><div className="col-md-7"><label className="form-label small fw-bold">Binding name</label><input className="form-control form-control-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></div><div className="col-md-5"><label className="form-label small fw-bold">Binding ID</label><input className="form-control form-control-sm font-monospace" value={draft.id} disabled={availableServices.some((item) => item.id === draft.id)}/></div></div>
      <h6>Properties</h6><div className="row g-3">{Object.entries(definition.propertySchema.properties || {}).filter(([key]) => !(definition.serviceKey === 'notification.email' && key === 'templates')).map(([key, schema]) => <div className={schema.type === 'object' ? 'col-12' : 'col-md-6'} key={key}><label className="form-label small fw-semibold">{schema.title || key}{definition.propertySchema.required?.includes(key) ? ' *' : ''}</label>{editor(schema, draft.config[key], (value) => {
        const config = { ...draft.config, [key]: value };
        const secretRefs = definition.serviceKey === 'notification.email' && key === 'transport'
          ? value === 'smtp'
            ? { smtpUsername: draft.secretRefs?.smtpUsername || 'env://LOWCODE_CONNECTION_SMTP_USERNAME', smtpPassword: draft.secretRefs?.smtpPassword || 'env://LOWCODE_CONNECTION_SMTP_PASSWORD' }
            : { providerEndpoint: draft.secretRefs?.providerEndpoint || 'env://LOWCODE_CONNECTION_MAIL_PROVIDER_ENDPOINT', providerToken: draft.secretRefs?.providerToken || 'env://LOWCODE_CONNECTION_MAIL_PROVIDER_TOKEN' }
          : definition.serviceKey === 'auth.session' && key === 'providers'
            ? Object.fromEntries([
                ['signingKey', draft.secretRefs?.signingKey || 'env://PLATFORM_JWT_SECRET'],
                ...(Array.isArray(value) ? value : []).flatMap((provider) => ['google', 'line', 'facebook', 'entra'].includes(String(provider)) ? [
                  [`${provider}ClientId`, draft.secretRefs?.[`${provider}ClientId`] || `env://LOWCODE_CONNECTION_${String(provider).toUpperCase()}_CLIENT_ID`],
                  [`${provider}ClientSecret`, draft.secretRefs?.[`${provider}ClientSecret`] || `env://LOWCODE_CONNECTION_${String(provider).toUpperCase()}_CLIENT_SECRET`],
                ] : []),
                ...((Array.isArray(value) ? value : []).some((provider) => provider === 'ldap' || provider === 'ad-ds') ? [
                  ['directoryBindDn', draft.secretRefs?.directoryBindDn || 'env://LOWCODE_CONNECTION_DIRECTORY_BIND_DN'],
                  ['directoryBindPassword', draft.secretRefs?.directoryBindPassword || 'env://LOWCODE_CONNECTION_DIRECTORY_BIND_PASSWORD'],
                ] : []),
              ])
          : draft.secretRefs;
        setDraft({ ...draft, config, secretRefs });
      }, key, collections)}{schema.description && <small className="text-muted">{schema.description}</small>}</div>)}</div>
      {definition.serviceKey === 'notification.email' && <div className="mt-3"><MailTemplateEditor value={draft.config.templates} onChange={(templates) => setDraft({ ...draft, config: { ...draft.config, templates, allowedTemplateIds: Object.keys(templates).sort() } })}/></div>}
      <h6 className="mt-4">Operations</h6><div className="d-flex flex-wrap gap-3">{Object.keys(definition.operations).map((operation) => <label className="form-check" key={operation}><input className="form-check-input" type="checkbox" checked={draft.policy?.allowedOperations.includes(operation) || false} onChange={(e) => { const current = draft.policy?.allowedOperations || []; setDraft({ ...draft, policy: { ...(draft.policy || { allowedOperations: [] }), allowedOperations: e.target.checked ? [...current, operation] : current.filter((item) => item !== operation) } }); }}/><span className="form-check-label">{operation}</span></label>)}</div>
      {Object.keys(draft.secretRefs || {}).length > 0 && <><h6 className="mt-4">Secret References</h6>{Object.entries(draft.secretRefs || {}).map(([key, value]) => <div className="input-group input-group-sm mb-2" key={key}><span className="input-group-text">{key}</span><input className="form-control font-monospace" value={value} onChange={(e) => setDraft({ ...draft, secretRefs: { ...(draft.secretRefs || {}), [key]: e.target.value } })}/></div>)}</>}
      {status && <div className={`alert py-2 mt-3 ${draft.status === 'invalid' ? 'alert-danger' : 'alert-info'}`}>{draft.status === 'invalid' ? <ShieldAlert size={14}/> : <CheckCircle2 size={14}/>} {status}</div>}
      <button className="btn btn-primary mt-3" onClick={() => void save()}><Save size={14}/> Validate & Save Binding</button>
    </div></div> : <div className="alert alert-secondary">Select a binding or add one from the Catalog.</div>}</div>
  </div>;
};
