'use client';
import React, { useEffect, useState } from 'react';
import { Braces, Database, FunctionSquare, Plus, Trash2, Variable } from 'lucide-react';

export type DataSourceKind = 'json_array' | 'query' | 'procedure' | 'function' | 'variables';
export interface DataSourceParameter { name: string; type: string; value?: unknown; required?: boolean; }
export interface ComponentDataSource { kind: DataSourceKind; statement?: string; name?: string; variables?: Record<string, unknown>; parameters: DataSourceParameter[]; source?: Record<string, unknown>; }

interface Props { dataSource?: Partial<ComponentDataSource>; sampleData?: unknown[]; onChange: (source: ComponentDataSource, sampleData: unknown[]) => void; }
const OPTIONS = [
  { value: 'json_array', label: 'JSON Array', icon: Braces }, { value: 'query', label: 'Query', icon: Database },
  { value: 'procedure', label: 'Procedure', icon: Database }, { value: 'function', label: 'Function', icon: FunctionSquare },
  { value: 'variables', label: 'Variables', icon: Variable },
] as const;

export const DataSourcePropertyEditor: React.FC<Props> = ({ dataSource, sampleData = [], onChange }) => {
  const source: ComponentDataSource = { kind: dataSource?.kind || 'json_array', statement: dataSource?.statement || '', name: dataSource?.name || '', variables: dataSource?.variables || {}, parameters: dataSource?.parameters || [], source: dataSource?.source };
  const [sampleText, setSampleText] = useState(JSON.stringify(sampleData, null, 2));
  const [variablesText, setVariablesText] = useState(JSON.stringify(source.variables || {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => { setSampleText(JSON.stringify(sampleData, null, 2)); }, [sampleData]);

  const update = (patch: Partial<ComponentDataSource>, nextSample = sampleData) => onChange({ ...source, ...patch }, nextSample);
  const updateSample = (text: string) => { setSampleText(text); try { const parsed = JSON.parse(text); if (!Array.isArray(parsed)) throw new Error('Sample Data ต้องเป็น JSON Array'); setJsonError(null); update({}, parsed); } catch (error) { setJsonError(error instanceof Error ? error.message : 'JSON ไม่ถูกต้อง'); } };
  const updateVariables = (text: string) => { setVariablesText(text); try { const parsed = JSON.parse(text); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Variables ต้องเป็น JSON Object'); setJsonError(null); update({ variables: parsed }); } catch (error) { setJsonError(error instanceof Error ? error.message : 'JSON ไม่ถูกต้อง'); } };
  const updateParameter = (index: number, patch: Partial<DataSourceParameter>) => update({ parameters: source.parameters.map((parameter, itemIndex) => itemIndex === index ? { ...parameter, ...patch } : parameter) });

  return <div className="bg-light p-3 rounded-3 border border-primary border-opacity-25">
    <label className="form-label extra-small fw-bold text-secondary mb-2 d-block">data · DATA SOURCE</label>
    {source.source?.file != null && <div className="alert alert-secondary py-1 px-2 mb-2 font-monospace" style={{ fontSize: 10 }}>Source: {String(source.source.file)}</div>}
    <div className="row g-2 mb-3">{OPTIONS.map((option) => { const Icon = option.icon; return <div className="col" key={option.value}><button type="button" className={`btn btn-sm w-100 h-100 px-1 ${source.kind === option.value ? 'btn-primary' : 'btn-outline-secondary bg-white'}`} style={{ fontSize: 10 }} onClick={() => update({ kind: option.value })}><Icon size={12} className="me-1" />{option.label}</button></div>; })}</div>

    {source.kind === 'query' && <div className="mb-3"><label className="form-label extra-small fw-semibold">SQL Query</label><textarea className="form-control form-control-sm font-monospace" rows={4} value={source.statement} placeholder="SELECT id, name FROM cms_post WHERE status = :status" onChange={(event) => update({ statement: event.target.value })} /></div>}
    {(source.kind === 'procedure' || source.kind === 'function') && <div className="mb-3"><label className="form-label extra-small fw-semibold">{source.kind === 'procedure' ? 'Procedure' : 'Function'} Name</label><input className="form-control form-control-sm font-monospace" value={source.name} placeholder={source.kind === 'procedure' ? 'cms_get_posts' : 'cms_search_posts'} onChange={(event) => update({ name: event.target.value })} /></div>}
    {source.kind === 'variables' && <div className="mb-3"><label className="form-label extra-small fw-semibold">Variables (JSON Object)</label><textarea className="form-control form-control-sm font-monospace" rows={4} value={variablesText} onChange={(event) => updateVariables(event.target.value)} /></div>}
    {source.kind === 'json_array' && <div className="alert alert-info py-2 extra-small">ใช้ Sample Data ด้านล่างเป็นข้อมูลจริงของ component ใน Design/Preview</div>}

    <div className="d-flex align-items-center justify-content-between mb-1"><label className="form-label extra-small fw-bold mb-0">Parameters</label><button type="button" className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => update({ parameters: [...source.parameters, { name: `param${source.parameters.length + 1}`, type: 'string', value: '', required: false }] })}><Plus size={11} /> Add</button></div>
    <div className="d-flex flex-column gap-1 mb-3">{source.parameters.map((parameter, index) => <div className="row g-1" key={index}>
      <div className="col-4"><input className="form-control form-control-sm" value={parameter.name} placeholder="name" onChange={(event) => updateParameter(index, { name: event.target.value })} /></div>
      <div className="col-3"><select className="form-select form-select-sm" value={parameter.type} onChange={(event) => updateParameter(index, { type: event.target.value })}><option>string</option><option>number</option><option>boolean</option><option>date</option><option>json</option></select></div>
      <div className="col-4"><input className="form-control form-control-sm" value={String(parameter.value ?? '')} placeholder="sample/default" onChange={(event) => updateParameter(index, { value: event.target.value })} /></div>
      <div className="col-1"><button type="button" className="btn btn-sm btn-outline-danger px-1" onClick={() => update({ parameters: source.parameters.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={11} /></button></div>
    </div>)}{source.parameters.length === 0 && <div className="text-muted extra-small py-1">No parameters</div>}</div>

    <label className="form-label extra-small fw-bold mb-1">Sample Data (JSON Array)</label>
    <textarea className={`form-control form-control-sm font-monospace ${jsonError ? 'is-invalid' : ''}`} rows={6} value={sampleText} onChange={(event) => updateSample(event.target.value)} />
    {jsonError && <div className="invalid-feedback d-block">{jsonError}</div>}
  </div>;
};
