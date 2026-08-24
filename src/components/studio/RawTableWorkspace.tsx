'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Braces, Database, Grid3X3, Play, RefreshCw, Terminal } from 'lucide-react';

export function RawTableWorkspace({ platformId, databaseName, tableName, onClose }: { platformId: string; databaseName: string; tableName: string; onClose: () => void }) {
  const [sql, setSql] = useState('');
  const [tab, setTab] = useState<'table' | 'json' | 'log'>('table');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => { setSql(`SELECT *\nFROM ${tableName}\nLIMIT 100;`); setColumns([]); setRows([]); setError(null); }, [tableName]);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/database/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) });
      const data = await response.json() as { columns?: string[]; rows?: unknown[][]; durationMs?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'Query failed');
      setColumns(data.columns || []); setRows(data.rows || []); setDuration(data.durationMs ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Query failed'); setTab('log'); }
    finally { setRunning(false); }
  };
  const objects = rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  const publish = async () => {
    setPublishing(true); setError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/database/publish`, { method: 'POST' });
      const data = await response.json() as { tables?: string[]; revision?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Publish failed');
      setTab('log'); setError(null); setDuration(null);
      setSql(`SELECT *\nFROM ${tableName}\nLIMIT 100;`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Publish failed'); setTab('log'); }
    finally { setPublishing(false); }
  };

  return <div className="card shadow-sm border-0 rounded-3 bg-white d-flex flex-column h-100 overflow-hidden">
    <div className="card-header text-white border-0 px-3 py-2 d-flex align-items-center justify-content-between" style={{ background: 'linear-gradient(120deg,#111827,#0f4c5c)' }}><div><div className="small text-info fw-bold">RAW TABLE WORKSPACE</div><div className="font-monospace fw-bold">{tableName} <span className="fw-normal opacity-75">{databaseName}</span></div></div><button className="btn btn-sm btn-outline-light d-flex align-items-center gap-1" onClick={onClose}><ArrowLeft size={14} /> Page Design</button></div>
    <div className="px-3 py-2 bg-light border-bottom d-flex align-items-center gap-2 small"><span className="text-primary fw-bold"><Database size={13} className="me-1" />Web แม่: Structure</span><span>→ Publish / Sync →</span><span className="text-success fw-bold">App ลูก: {databaseName}.{tableName} (Actual data)</span><button className="btn btn-sm btn-outline-primary ms-auto d-flex align-items-center gap-1" disabled={publishing} onClick={() => void publish()}><RefreshCw size={12} className={publishing ? 'spinner-border spinner-border-sm' : ''} />{publishing ? 'Publishing…' : 'Publish Structure'}</button></div>
    <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"><div><b>SQL Editor</b><div className="text-muted small">เชื่อมต่อ Tenant Database ของ App ลูกโดยตรง</div></div><button className="btn btn-success btn-sm d-flex gap-1 align-items-center" disabled={running} onClick={() => void run()}><Play size={13} />{running ? 'Running…' : 'Run query'}</button></div>
    <div className="bg-dark d-flex" style={{ minHeight: 245 }}><div className="text-secondary font-monospace text-end p-3 border-end border-secondary" style={{ lineHeight: 1.65 }}>{sql.split('\n').map((_, index) => <div key={index}>{index + 1}</div>)}</div><textarea className="form-control bg-dark text-light border-0 rounded-0 shadow-none font-monospace p-3" style={{ resize: 'none', lineHeight: 1.65 }} value={sql} onChange={(event) => setSql(event.target.value)} /></div>
    <div className="nav nav-tabs px-2 border-bottom">{([{ id: 'table', label: 'ตาราง', icon: Grid3X3 }, { id: 'json', label: 'JSON', icon: Braces }, { id: 'log', label: 'Log', icon: Terminal }] as const).map((item) => <button key={item.id} className={`nav-link ${tab === item.id ? 'active fw-bold' : ''}`} onClick={() => setTab(item.id)}><item.icon size={13} className="me-1" />{item.label}</button>)}<span className="ms-auto align-self-center small text-muted">{rows.length} rows{duration !== null ? ` · ${duration} ms` : ''}</span></div>
    <div className="flex-grow-1 overflow-auto">{tab === 'table' && <table className="table table-sm table-hover mb-0"><thead className="table-light sticky-top"><tr>{columns.map((column) => <th className="px-3 font-monospace" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((value, ci) => <td className="px-3 font-monospace" key={ci}>{value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>)}</tr>)}</tbody></table>}{tab === 'json' && <pre className="bg-dark text-light h-100 p-3 m-0">{JSON.stringify(objects, null, 2)}</pre>}{tab === 'log' && <div className="bg-dark text-light h-100 p-3 font-monospace"><div className="text-success">TARGET DATABASE: {databaseName}</div><div className="text-info mt-2">{sql.replace(/\s+/g, ' ')}</div><div className={`mt-2 ${error ? 'text-danger' : 'text-success'}`}>{error ? `ERROR: ${error}` : duration !== null ? `Query completed: ${rows.length} rows in ${duration} ms` : 'Ready'}</div></div>}</div>
  </div>;
}
