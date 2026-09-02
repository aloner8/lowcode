'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Braces, ChevronDown, ChevronRight, Database, Eye, Grid3X3, Layers3, Play, Plus, Save, Sparkles, Terminal, WandSparkles, X } from 'lucide-react';
import { FormComponent } from '@/components/shared/FormComponent';
import type { FieldInputProps } from '@/components/shared/FieldInputComponent';

type Platform = { id: string; platformName: string };
type TableColumn = { columnName: string; dataType: string; isNullable: boolean; isPrimaryKey: boolean };
type TenantTable = { tableName: string; columns: TableColumn[]; rowCount: number };
type PlatformDatabase = { name: string; label: string; kind: 'platform' | 'app'; appId?: string };
type ContractField = { id: string; name: string; type: string; required?: boolean; source?: string };
type CollectionOperation = {
  id: string; label: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  callType: 'query' | 'procedure'; query: string; procedure: string;
  request: ContractField[]; response: ContractField[];
  formButton: 'none' | 'submit' | 'save' | 'update' | 'delete' | 'search' | 'custom';
};
type GeneratedComponent = { id: string; type: string; label: string; props: Record<string, unknown> };
type CollectionDefinition = {
  schemaVersion: 1; moduleId: string; databaseName: string; table: string; primaryKey: string[];
  operations: CollectionOperation[]; sql: string;
  components: GeneratedComponent[];
};
type CollectionDto = { id: string; platformId: string; key: string; name: string; definition: CollectionDefinition; version: number; isPublic?: boolean };
type PublicCollectionDto = Omit<CollectionDto, 'version' | 'isPublic'> & { sourceVersion: number; publisherName?: string };
type ComponentReference = { id: string; key: string; name: string; componentType: string; definition: Record<string, unknown>; pages?: Array<{ id: string; title: string; slug: string }> };

const field = (name: string, type: string, required = false, source?: string): ContractField => ({ id: crypto.randomUUID(), name, type, required, source });
const operationDefaults = (table = 'table_name', listSql = `SELECT *\nFROM ${table}\nLIMIT 100;`): CollectionOperation[] => [
  { id: 'list', label: 'List records', method: 'GET', callType: 'query', query: listSql, procedure: '', request: [field('search', 'string'), field('limit', 'number'), field('offset', 'number')], response: [field('items', 'array'), field('total', 'number')], formButton: 'search' },
  { id: 'get', label: 'Get record', method: 'GET', callType: 'query', query: `SELECT * FROM ${table} WHERE id = :id`, procedure: '', request: [field('id', 'number', true, 'route.id')], response: [field('item', 'object')], formButton: 'none' },
  { id: 'create', label: 'Create record', method: 'POST', callType: 'procedure', query: '', procedure: `${table}_create`, request: [field('data', 'object', true, 'form.values')], response: [field('item', 'object'), field('success', 'boolean')], formButton: 'submit' },
  { id: 'update', label: 'Update record', method: 'PATCH', callType: 'procedure', query: '', procedure: `${table}_update`, request: [field('id', 'number', true, 'route.id'), field('data', 'object', true, 'form.values')], response: [field('item', 'object'), field('success', 'boolean')], formButton: 'update' },
  { id: 'delete', label: 'Delete record', method: 'DELETE', callType: 'procedure', query: '', procedure: `${table}_delete`, request: [field('id', 'number', true, 'selectedRow.id')], response: [field('success', 'boolean')], formButton: 'delete' },
];
const emptyDefinition = (): CollectionDefinition => ({ schemaVersion: 1, moduleId: 'custom', databaseName: '', table: '', primaryKey: ['id'], operations: operationDefaults(), sql: 'SELECT *\nFROM table_name\nLIMIT 100;', components: [] });
const normalizeDefinition = (value: Partial<CollectionDefinition> | null | undefined): CollectionDefinition => {
  const fallback = emptyDefinition();
  const legacyComponents = Array.isArray(value?.components) ? value.components as unknown as Array<{ componentTree?: Array<{ props?: { dataSource?: { statement?: unknown } } }> }> : [];
  const legacySql = legacyComponents.flatMap((component) => component.componentTree || []).map((node) => node.props?.dataSource?.statement).find((statement): statement is string => typeof statement === 'string');
  const tableSql = value?.table ? `SELECT *\nFROM ${value.table}\nLIMIT 100;` : fallback.sql;
  const normalizedOperations = Array.isArray(value?.operations) && value.operations.length
    ? (value.operations as unknown[]).map((operation) => {
        if (typeof operation === 'string') return operationDefaults(value?.table || 'table_name', legacySql || tableSql).find((item) => item.id === operation) || operationDefaults()[0];
        const item = operation as Partial<CollectionOperation>;
        const base = operationDefaults(value?.table || 'table_name', legacySql || tableSql).find((entry) => entry.id === item.id) || operationDefaults()[0];
        return { ...base, ...item, request: Array.isArray(item.request) ? item.request : base.request, response: Array.isArray(item.response) ? item.response : base.response };
      })
    : operationDefaults(value?.table || 'table_name', legacySql || tableSql);
  return {
    ...fallback,
    ...value,
    primaryKey: Array.isArray(value?.primaryKey) ? value.primaryKey : fallback.primaryKey,
    operations: normalizedOperations,
    components: Array.isArray(value?.components) ? value.components : fallback.components,
    sql: typeof value?.sql === 'string' ? value.sql : legacySql || tableSql,
  };
};
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-|-$/g, '') || `collection-${Date.now().toString(36)}`;

export default function CollectionDesigner() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]), [platformId, setPlatformId] = useState('');
  const [mine, setMine] = useState<CollectionDto[]>([]), [publicSets, setPublicSets] = useState<PublicCollectionDto[]>([]);
  const [listTab, setListTab] = useState<'mine' | 'public'>('mine'), [screen, setScreen] = useState<'list' | 'designer'>('list');
  const [collectionId, setCollectionId] = useState<string | null>(null), [collectionKey, setCollectionKey] = useState('new-collection'), [collectionName, setCollectionName] = useState('Collection Set ใหม่');
  const [definition, setDefinition] = useState<CollectionDefinition>(emptyDefinition), [tables, setTables] = useState<TenantTable[]>([]);
  const [databases, setDatabases] = useState<PlatformDatabase[]>([]), [references, setReferences] = useState<ComponentReference[]>([]);
  const [previewReference, setPreviewReference] = useState<ComponentReference | null>(null), [generatingProcedure, setGeneratingProcedure] = useState('');
  const [leftTab, setLeftTab] = useState<'database' | 'operations'>('database');
  const [activeOperationId, setActiveOperationId] = useState('list');
  const [openOperations, setOpenOperations] = useState<Record<string, boolean>>({ list: true });
  const [resultTab, setResultTab] = useState<'table' | 'json' | 'log'>('table'), [columns, setColumns] = useState<string[]>([]), [rows, setRows] = useState<unknown[][]>([]);
  const [status, setStatus] = useState('กำลังโหลด...'), [running, setRunning] = useState(false), [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (screen === 'designer') window.dispatchEvent(new CustomEvent('collection-caption-change', { detail: collectionName }));
  }, [collectionName, screen]);

  useEffect(() => { void (async () => {
    const response = await fetch('/api/platforms', { cache: 'no-store' });
    const data = await response.json() as { platforms?: Platform[] };
    const list = data.platforms || []; setPlatforms(list);
    const params = new URLSearchParams(window.location.search), requested = params.get('platformId'), requestedCollection = params.get('collectionId');
    let resolved = '';
    if (!requested && requestedCollection && requestedCollection !== 'new') {
      const resolveResponse = await fetch(`/api/collection-sets?collectionId=${encodeURIComponent(requestedCollection)}`, { cache: 'no-store' });
      if (resolveResponse.ok) resolved = ((await resolveResponse.json()) as { collection?: CollectionDto }).collection?.platformId || '';
    }
    const last = localStorage.getItem('matchanu:last-studio-platform-id');
    setPlatformId(list.find((item) => item.id === requested)?.id || list.find((item) => item.id === resolved)?.id || list.find((item) => item.id === last)?.id || list[0]?.id || '');
  })(); }, []);

  useEffect(() => { if (!platformId) return; void (async () => {
    setStatus('กำลังโหลด Collection Set และโครงสร้างฐานข้อมูล...');
    localStorage.setItem('matchanu:last-studio-platform-id', platformId);
    const [setsResponse, databasesResponse] = await Promise.all([
      fetch(`/api/collection-sets?platformId=${encodeURIComponent(platformId)}`, { cache: 'no-store' }),
      fetch(`/api/platforms/${platformId}/databases`, { cache: 'no-store' }),
    ]);
    const setsData = await setsResponse.json() as { collections?: CollectionDto[]; publicCollections?: PublicCollectionDto[]; error?: string };
    const databasesData = await databasesResponse.json() as { databases?: PlatformDatabase[]; error?: string };
    if (!setsResponse.ok) return setStatus(setsData.error || 'โหลด Collection Set ไม่สำเร็จ กรุณารัน migration 025');
    const availableDatabases = databasesData.databases || [];
    setMine(setsData.collections || []); setPublicSets(setsData.publicCollections || []); setDatabases(availableDatabases);
    const requested = new URLSearchParams(window.location.search).get('collectionId');
    const selected = setsData.collections?.find((item) => item.id === requested || item.key === requested);
    if (selected) {
      setCollectionId(selected.id); setCollectionKey(selected.key); setCollectionName(selected.name);
      const normalized = normalizeDefinition(structuredClone(selected.definition));
      setDefinition({ ...normalized, databaseName: availableDatabases.some((item) => item.name === normalized.databaseName) ? normalized.databaseName : availableDatabases[0]?.name || '' }); setScreen('designer');
    } else if (requested === 'new') {
      setCollectionId(null); setCollectionKey(`collection-${crypto.randomUUID().slice(0, 8)}`);
      setCollectionName('Collection Set ใหม่'); setDefinition({ ...emptyDefinition(), databaseName: availableDatabases[0]?.name || '' }); setScreen('designer');
    } else setScreen('list');
    setStatus(databasesResponse.ok ? 'พร้อมออกแบบ' : databasesData.error || 'โหลดรายชื่อฐานข้อมูลไม่สำเร็จ');
  })(); }, [platformId]);

  useEffect(() => { if (!platformId || !definition.databaseName) return; void (async () => {
    const response = await fetch(`/api/platforms/${platformId}/database/tables?database=${encodeURIComponent(definition.databaseName)}`, { cache: 'no-store' });
    const data = await response.json() as { tables?: TenantTable[]; error?: string };
    if (!response.ok) { setTables([]); setStatus(data.error || 'Unable to load database schema'); return; }
    setTables(data.tables || []);
  })(); }, [platformId, definition.databaseName]);

  useEffect(() => { if (!collectionId) return; void (async () => {
    const response = await fetch(`/api/collection-sets/${collectionId}/references`, { cache: 'no-store' });
    const data = await response.json() as { references?: ComponentReference[] };
    if (response.ok) setReferences(data.references || []);
  })(); }, [collectionId]);

  const openCollection = (item: CollectionDto, navigate = true) => {
    const normalized = normalizeDefinition(structuredClone(item.definition));
    setCollectionId(item.id); setCollectionKey(item.key); setCollectionName(item.name); setDefinition({ ...normalized, databaseName: databases.some((database) => database.name === normalized.databaseName) ? normalized.databaseName : databases[0]?.name || '' }); setScreen('designer');
    if (navigate) router.push(`/collection-designer?collectionId=${encodeURIComponent(item.id)}`);
  };
  const newCollection = (navigate = true) => {
    setCollectionId(null); setReferences([]); setCollectionKey(`collection-${crypto.randomUUID().slice(0, 8)}`); setCollectionName('Collection Set ใหม่'); setDefinition({ ...emptyDefinition(), databaseName: databases[0]?.name || '' }); setScreen('designer');
    if (navigate) router.push(`/collection-designer?platformId=${encodeURIComponent(platformId)}&collectionId=new`);
  };
  const chooseTable = (table: string) => {
    const schema = tables.find((item) => item.tableName === table);
    const sql = `SELECT *\nFROM ${table}\nLIMIT 100;`;
    setDefinition((current) => ({ ...current, table, primaryKey: schema?.columns.filter((column) => column.isPrimaryKey).map((column) => column.columnName) || ['id'], sql, operations: operationDefaults(table, sql) }));
    setActiveOperationId('list');
  };
  const chooseDatabase = (databaseName: string) => {
    setDefinition((current) => ({ ...current, databaseName, table: '', primaryKey: ['id'], sql: 'SELECT *\nFROM table_name\nLIMIT 100;', operations: operationDefaults(), components: [] }));
    setColumns([]); setRows([]); setActiveOperationId('list');
  };
  const activeOperation = definition.operations.find((operation) => operation.id === activeOperationId);
  const editorSql = leftTab === 'operations' && activeOperation?.callType === 'query' ? activeOperation.query : definition.sql;
  const updateOperation = (operationId: string, changes: Partial<CollectionOperation>) => setDefinition((current) => ({ ...current, operations: current.operations.map((operation) => operation.id === operationId ? { ...operation, ...changes } : operation) }));
  const updateEditorSql = (sql: string) => {
    if (leftTab === 'operations' && activeOperation?.callType === 'query') updateOperation(activeOperation.id, { query: sql });
    else setDefinition((current) => ({ ...current, sql }));
  };
  const addContractField = (operation: CollectionOperation, kind: 'request' | 'response') => updateOperation(operation.id, { [kind]: [...operation[kind], field(kind === 'request' ? 'input' : 'result', 'string')] });
  const updateContractField = (operation: CollectionOperation, kind: 'request' | 'response', fieldId: string, changes: Partial<ContractField>) => updateOperation(operation.id, { [kind]: operation[kind].map((item) => item.id === fieldId ? { ...item, ...changes } : item) });
  const generateProcedure = async (operation: CollectionOperation) => {
    if (!definition.databaseName || !definition.table || !operation.procedure) return setStatus('เลือกฐานข้อมูล Table และระบุชื่อ Procedure ก่อน');
    setGeneratingProcedure(operation.id); setStatus(`กำลัง Create or Replace Procedure ${operation.procedure}...`);
    const response = await fetch(`/api/platforms/${platformId}/database/procedures`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ database: definition.databaseName, table: definition.table, collectionId, operation }) });
    const data = await response.json() as { signature?: string; error?: string };
    setGeneratingProcedure('');
    if (!response.ok) return setStatus(data.error || 'สร้าง Procedure ไม่สำเร็จ');
    setStatus(`Create or Replace สำเร็จ: ${data.signature}`);
  };
  const save = async () => {
    if (!platformId || !collectionName.trim()) return;
    setStatus('กำลังบันทึก Collection Set...');
    const response = await fetch('/api/collection-sets', { method: collectionId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformId, collectionId, key: slug(collectionKey), name: collectionName.trim(), definition }) });
    const data = await response.json() as { collection?: CollectionDto; error?: string };
    if (!response.ok || !data.collection) return setStatus(data.error || 'บันทึกไม่สำเร็จ');
    setCollectionId(data.collection.id); setMine((current) => [data.collection!, ...current.filter((item) => item.id !== data.collection?.id)]); router.replace(`/collection-designer?collectionId=${encodeURIComponent(data.collection.id)}`); setStatus(`บันทึกแล้ว · version ${data.collection.version}`);
  };
  const publish = async (item: CollectionDto) => {
    const response = await fetch('/api/collection-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', platformId, collectionId: item.id }) });
    const data = await response.json() as { error?: string }; if (!response.ok) return setStatus(data.error || 'เผยแพร่ไม่สำเร็จ');
    setMine((current) => current.map((entry) => entry.id === item.id ? { ...entry, isPublic: true } : entry)); setStatus('เผยแพร่ Collection Set เวอร์ชันนี้แล้ว');
  };
  const clone = async (item: PublicCollectionDto) => {
    const response = await fetch('/api/collection-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clone', platformId, sharedCollectionId: item.id }) });
    const data = await response.json() as { collection?: CollectionDto; error?: string }; if (!response.ok || !data.collection) return setStatus(data.error || 'Clone ไม่สำเร็จ');
    setMine((current) => [data.collection!, ...current]); setListTab('mine'); setStatus('Clone เข้า Collection ของฉันแล้ว');
  };
  const runQuery = async () => {
    setRunning(true); setStatus('กำลังรัน Query...');
    const response = await fetch(`/api/platforms/${platformId}/database/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: editorSql, database: definition.databaseName }) });
    const data = await response.json() as { columns?: string[]; rows?: unknown[][]; durationMs?: number; error?: string };
    setRunning(false); if (!response.ok) { setResultTab('log'); return setStatus(data.error || 'Query failed'); }
    setColumns(data.columns || []); setRows(data.rows || []); setDuration(data.durationMs ?? null); setResultTab('table'); setStatus(`Query สำเร็จ ${(data.rows || []).length} rows`);
  };
  const generateComponents = () => {
    const base = collectionKey || 'collection', title = collectionName, table = definition.table;
    const operationBindings = Object.fromEntries(definition.operations.filter((operation) => operation.formButton !== 'none').map((operation) => [operation.formButton, operation.id]));
    const listOperation = definition.operations.find((operation) => operation.id === 'list');
    const dataStatement = listOperation?.callType === 'query' ? listOperation.query : definition.sql;
    const generated: GeneratedComponent[] = [
      { id: `${base}.datatable`, type: 'DataTableComponent', label: 'Data Table', props: { title, collectionId: base, dataSource: { kind: listOperation?.callType || 'query', statement: dataStatement, procedure: listOperation?.procedure }, columns: columns.map((key) => ({ key, label: key })), rowActions: definition.operations.filter((operation) => ['get','update','delete'].includes(operation.id)).map((operation) => operation.id), operationBindings } },
      { id: `${base}.form`, type: 'FormComponent', label: 'Form', props: { title, collectionId: base, operationBindings, fields: (tables.find((item) => item.tableName === table)?.columns || []).map((column) => ({ name: column.columnName, label: column.columnName, type: column.dataType.includes('int') ? 'number' : 'text', required: !column.isNullable })) } },
      { id: `${base}.list`, type: 'ListComponent', label: 'List', props: { title, collectionId: base, dataSource: { kind: listOperation?.callType || 'query', statement: dataStatement, procedure: listOperation?.procedure }, primaryField: columns[1] || columns[0] || 'name' } },
      { id: `${base}.gallery`, type: 'GalleryComponent', label: 'Gallery', props: { title, collectionId: base, dataSource: { kind: listOperation?.callType || 'query', statement: dataStatement, procedure: listOperation?.procedure }, imageField: 'imageUrl', titleField: columns[1] || 'name', columns: 3 } },
      { id: `${base}.view-detail`, type: 'DynamicHtmlComponent', label: 'View Detail', props: { title: `${title} Detail`, collectionId: base, content: `<article><h2>{{${columns[1] || 'name'}}}</h2><p>{{${columns[2] || 'description'}}}</p></article>` } },
      { id: `${base}.document`, type: 'DocumentComponent', label: 'Document', props: { title: `${title} Document`, collectionId: base, outputFormats: ['screen', 'pdf'], page: { size: 'A4', orientation: 'portrait' } } },
    ];
    setDefinition((current) => ({ ...current, components: generated })); setStatus('สร้าง Auto Component 6 ประเภทแล้ว กรุณาบันทึก Collection Set');
  };
  const resultObjects = useMemo(() => rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]]))), [columns, rows]);
  const componentReferences = useMemo<ComponentReference[]>(() => {
    const local = definition.components.map((component) => ({ id: component.id, key: component.id, name: component.label, componentType: component.type, definition: component.props }));
    return Array.from(new Map([...local, ...references].map((item) => [item.id, item])).values());
  }, [definition.components, references]);
  const previewFields = useMemo<FieldInputProps[]>(() => {
    if (!previewReference) return [];
    const fields = previewReference.definition.fields;
    return Array.isArray(fields) ? fields as FieldInputProps[] : [];
  }, [previewReference]);

  if (screen === 'list') {
    const items = listTab === 'mine' ? mine : publicSets;
    return <div className="d-flex flex-column bg-light" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <header className="bg-white border-bottom px-4 py-3 d-flex align-items-center gap-3"><a href="/admin" className="btn btn-sm btn-outline-secondary"><ArrowLeft size={14}/> กลับ</a><Database size={22} className="text-primary"/><div><h2 className="h5 mb-0">Collection Set</h2><div className="small text-secondary">ฐานข้อมูล, Query, Procedure Flow และ Auto Component</div></div><select className="form-select form-select-sm ms-auto" style={{ width: 260 }} value={platformId} onChange={(event) => { setPlatformId(event.target.value); router.push(`/collection-designer?platformId=${encodeURIComponent(event.target.value)}`); }}><option value="">เลือก Platform</option>{platforms.map((item) => <option key={item.id} value={item.id}>{item.platformName}</option>)}</select><button className="btn btn-primary" onClick={() => newCollection()}><Plus size={16}/> สร้าง Collection Set</button></header>
      <main className="container-fluid p-4"><div className="d-flex border-bottom mb-3"><button className={`btn rounded-0 border-0 border-bottom border-3 ${listTab === 'mine' ? 'border-primary text-primary fw-bold' : 'border-transparent'}`} onClick={() => setListTab('mine')}>Collection ของฉัน <span className="badge text-bg-secondary">{mine.length}</span></button><button className={`btn rounded-0 border-0 border-bottom border-3 ${listTab === 'public' ? 'border-primary text-primary fw-bold' : 'border-transparent'}`} onClick={() => setListTab('public')}>Collection สาธารณะ <span className="badge text-bg-secondary">{publicSets.length}</span></button><span className="small text-success ms-auto align-self-center">{status}</span></div>
      {items.length ? <div className="table-responsive bg-white border rounded shadow-sm"><table className="table table-hover align-middle mb-0"><thead className="table-light"><tr><th>ชื่อ Collection</th><th>Collection ID</th><th>Table</th><th>Components</th><th>Version</th>{listTab === 'public' && <th>สร้างโดย</th>}<th className="text-end">จัดการ</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="fw-semibold">{item.name}</td><td><code>{item.key}</code></td><td><code>{item.definition.table || '-'}</code></td><td>{item.definition.components?.length || 0}</td><td>v{'version' in item ? item.version : item.sourceVersion}</td>{listTab === 'public' && <td>{'publisherName' in item ? item.publisherName : '-'}</td>}<td className="text-end">{listTab === 'mine' ? <div className="d-flex justify-content-end gap-2"><button className="btn btn-sm btn-outline-secondary" disabled={(item as CollectionDto).isPublic} onClick={() => void publish(item as CollectionDto)}>{(item as CollectionDto).isPublic ? 'Public แล้ว' : 'ตั้งเป็น Public'}</button><button className="btn btn-sm btn-outline-primary" onClick={() => openCollection(item as CollectionDto)}>ออกแบบ</button></div> : <button className="btn btn-sm btn-primary" onClick={() => void clone(item as PublicCollectionDto)}>Clone เข้า Collection ของฉัน</button>}</td></tr>)}</tbody></table></div> : <div className="bg-white border rounded p-5 text-center"><Database size={44} className="text-secondary mb-3"/><h3 className="h5">{listTab === 'mine' ? 'ยังไม่มี Collection ของฉัน' : 'ยังไม่มี Collection สาธารณะจากผู้ใช้อื่น'}</h3>{listTab === 'mine' && <button className="btn btn-primary mt-2" onClick={() => newCollection()}><Plus size={15}/> สร้าง Collection Set</button>}</div>}</main>
    </div>;
  }

  return <div className="d-flex flex-column bg-light" style={{ height: 'calc(100vh - 64px)' }}>
    <header className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2"><a href={`/collection-designer?platformId=${encodeURIComponent(platformId)}`} className="btn btn-sm btn-outline-secondary"><ArrowLeft size={14}/> รายการ Collection</a><Database size={18} className="text-primary"/><strong>{collectionName}</strong><span className="small text-success ms-auto">{status}</span><button className="btn btn-sm btn-outline-primary" onClick={generateComponents}><Sparkles size={14}/> Auto Component 6 แบบ</button><button className="btn btn-sm btn-success" onClick={() => void save()}><Save size={14}/> บันทึก</button></header>
    <div className="d-grid flex-grow-1 overflow-hidden" style={{ gridTemplateColumns: '280px minmax(0,1fr)' }}>
      <aside className="bg-white border-end overflow-auto">
        <div className="d-flex border-bottom sticky-top bg-white" style={{ zIndex: 2 }}>
          <button className={`btn flex-fill rounded-0 border-0 border-bottom border-3 ${leftTab === 'database' ? 'border-primary text-primary fw-bold' : 'border-transparent text-secondary'}`} onClick={() => setLeftTab('database')}><Database size={13}/> ฐานข้อมูล</button>
          <button className={`btn flex-fill rounded-0 border-0 border-bottom border-3 ${leftTab === 'operations' ? 'border-primary text-primary fw-bold' : 'border-transparent text-secondary'}`} onClick={() => setLeftTab('operations')}><Layers3 size={13}/> Operations</button>
        </div>
        {leftTab === 'database' ? <div className="p-3">
          <h6><Database size={15}/> ตั้งค่าฐานข้อมูล</h6>
          <label className="form-label small">ฐานข้อมูลของ Platform</label><select className="form-select form-select-sm mb-2 font-monospace" value={definition.databaseName} onChange={(e) => chooseDatabase(e.target.value)}><option value="">เลือกฐานข้อมูล</option>{databases.map((database) => <option key={database.name} value={database.name}>{database.label} · {database.name}</option>)}</select>
          <label className="form-label small">Collection ID</label><input className="form-control form-control-sm mb-2 font-monospace" disabled={Boolean(collectionId)} value={collectionKey} onChange={(e) => setCollectionKey(e.target.value)}/>
          <label className="form-label small">ชื่อ Collection</label><input className="form-control form-control-sm mb-2" value={collectionName} onChange={(e) => setCollectionName(e.target.value)}/>
          <label className="form-label small">Module</label><input className="form-control form-control-sm mb-2" value={definition.moduleId} onChange={(e) => setDefinition({ ...definition, moduleId: e.target.value })}/>
          <label className="form-label small">Table จริงใน Tenant DB</label><select className="form-select form-select-sm mb-3" value={definition.table} onChange={(e) => chooseTable(e.target.value)}><option value="">เลือก Table</option>{tables.map((table) => <option key={table.tableName} value={table.tableName}>{table.tableName} ({table.rowCount})</option>)}</select>
          <div className="small text-muted">Primary Key: <code>{definition.primaryKey.join(', ')}</code></div>
        </div> : <div className="p-2">
          <div className="small text-muted px-2 mb-2">Level 1: Operation · Level 2: API call, Request, Response และปุ่ม Form</div>
          {definition.operations.map((operation) => {
            const open = openOperations[operation.id] === true;
            return <div key={operation.id} className="border rounded mb-2 overflow-hidden">
              <button className={`btn btn-sm w-100 rounded-0 border-0 d-flex align-items-center gap-2 text-start ${activeOperationId === operation.id ? 'bg-primary bg-opacity-10 text-primary fw-bold' : 'bg-light'}`} onClick={() => { setActiveOperationId(operation.id); setOpenOperations((current) => ({ ...current, [operation.id]: !open })); }}>
                {open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}<span>{operation.id}</span><span className={`badge ms-auto ${operation.method === 'GET' ? 'text-bg-success' : operation.method === 'DELETE' ? 'text-bg-danger' : 'text-bg-primary'}`}>{operation.method}</span>
              </button>
              {open && <div className="p-2 border-top">
                <label className="form-label small mb-1">ชื่อ Operation</label><input className="form-control form-control-sm mb-2" value={operation.label} onChange={(e) => updateOperation(operation.id, { label: e.target.value })}/>
                <div className="row g-1 mb-2"><div className="col-5"><label className="form-label small mb-1">Method</label><select className="form-select form-select-sm" value={operation.method} onChange={(e) => updateOperation(operation.id, { method: e.target.value as CollectionOperation['method'] })}><option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option></select></div><div className="col-7"><label className="form-label small mb-1">API Call</label><select className="form-select form-select-sm" value={operation.callType} onChange={(e) => updateOperation(operation.id, { callType: e.target.value as CollectionOperation['callType'] })}><option value="query">Query เอง</option><option value="procedure">Call Procedure</option></select></div></div>
                {operation.callType === 'procedure' ? <><label className="form-label small mb-1">Procedure name</label><input className="form-control form-control-sm font-monospace mb-2" value={operation.procedure} onChange={(e) => updateOperation(operation.id, { procedure: e.target.value })}/><button className="btn btn-sm btn-outline-success w-100 mb-2" disabled={generatingProcedure === operation.id || !definition.databaseName || !definition.table} onClick={() => void generateProcedure(operation)}><WandSparkles size={12}/> {generatingProcedure === operation.id ? 'กำลังสร้าง...' : 'Generate / Replace Procedure'}</button><div className="small text-muted mb-2"><code>proc(jsonInput jsonb, INOUT jsonOut jsonb)</code></div></> : <button className="btn btn-sm btn-outline-primary w-100 mb-2" onClick={() => setActiveOperationId(operation.id)}><Terminal size={12}/> แก้ Query ใน SQL Editor</button>}
                <label className="form-label small mb-1">ผูกกับปุ่ม Form</label><select className="form-select form-select-sm mb-2" value={operation.formButton} onChange={(e) => updateOperation(operation.id, { formButton: e.target.value as CollectionOperation['formButton'] })}><option value="none">ไม่ผูก</option><option value="submit">Submit</option><option value="save">Save</option><option value="update">Update</option><option value="delete">Delete</option><option value="search">Search</option><option value="custom">Custom Button</option></select>
                {(['request','response'] as const).map((kind) => <div key={kind} className="mt-2"><div className="d-flex align-items-center mb-1"><b className="small text-uppercase">{kind}</b><button className="btn btn-sm border-0 text-primary ms-auto p-0" onClick={() => addContractField(operation, kind)}><Plus size={12}/> เพิ่ม</button></div>{operation[kind].map((item) => <div key={item.id} className="border rounded p-1 mb-1"><div className="d-flex gap-1"><input className="form-control form-control-sm font-monospace" value={item.name} onChange={(e) => updateContractField(operation, kind, item.id, { name: e.target.value })}/><select className="form-select form-select-sm" style={{ width: 90 }} value={item.type} onChange={(e) => updateContractField(operation, kind, item.id, { type: e.target.value })}><option>string</option><option>number</option><option>boolean</option><option>object</option><option>array</option></select></div>{kind === 'request' && <div className="d-flex align-items-center gap-1 mt-1"><input className="form-control form-control-sm" placeholder="source เช่น form.values" value={item.source || ''} onChange={(e) => updateContractField(operation, kind, item.id, { source: e.target.value })}/><label className="small text-nowrap"><input type="checkbox" className="form-check-input me-1" checked={Boolean(item.required)} onChange={(e) => updateContractField(operation, kind, item.id, { required: e.target.checked })}/>Req</label></div>}</div>)}</div>)}
              </div>}
            </div>;
          })}
        </div>}
      </aside>
      <main className="overflow-auto p-3"><div className="row g-3"><div className="col-xl-8"><section className="card shadow-sm mb-3"><div className="card-header d-flex align-items-center"><Terminal size={15} className="me-2 text-primary"/><b>SQL Editor{leftTab === 'operations' && activeOperation?.callType === 'query' ? ` · ${activeOperation.id}` : ''}</b><span className="badge text-bg-light border ms-2 font-monospace">{definition.databaseName || 'no database'}</span><button className="btn btn-sm btn-success ms-auto" disabled={running || !definition.databaseName || (leftTab === 'operations' && activeOperation?.callType === 'procedure')} onClick={() => void runQuery()}><Play size={13}/> {running ? 'Running...' : 'Run Query'}</button></div><textarea className="form-control bg-dark text-light border-0 rounded-0 font-monospace p-3" style={{ minHeight: 240 }} value={editorSql} disabled={leftTab === 'operations' && activeOperation?.callType === 'procedure'} onChange={(e) => updateEditorSql(e.target.value)}/><div className="nav nav-tabs px-2">{([{ id: 'table', label: 'ผลลัพธ์', icon: Grid3X3 }, { id: 'json', label: 'JSON', icon: Braces }, { id: 'log', label: 'Log', icon: Terminal }] as const).map((tab) => <button key={tab.id} className={`nav-link ${resultTab === tab.id ? 'active' : ''}`} onClick={() => setResultTab(tab.id)}><tab.icon size={12}/> {tab.label}</button>)}<span className="small text-muted ms-auto align-self-center">{rows.length} rows{duration !== null ? ` · ${duration} ms` : ''}</span></div><div className="overflow-auto" style={{ minHeight: 180, maxHeight: 300 }}>{resultTab === 'table' && <table className="table table-sm mb-0"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((value, ci) => <td key={ci}>{value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>)}</tr>)}</tbody></table>}{resultTab === 'json' && <pre className="bg-dark text-light p-3 h-100 m-0">{JSON.stringify(resultObjects, null, 2)}</pre>}{resultTab === 'log' && <pre className="bg-dark text-warning p-3 h-100 m-0">{status}</pre>}</div></section></div><div className="col-xl-4"><section className="card shadow-sm mb-3"><div className="card-header"><Database size={15} className="me-2 text-primary"/><b>Columns ({(tables.find((item) => item.tableName === definition.table)?.columns || []).length})</b></div><div className="list-group list-group-flush overflow-auto" style={{ maxHeight: 360 }}>{(tables.find((item) => item.tableName === definition.table)?.columns || []).map((column) => <div key={column.columnName} className="list-group-item"><div className="d-flex align-items-center"><code>{column.columnName}</code>{column.isPrimaryKey && <span className="badge text-bg-primary ms-auto">PK</span>}</div><div className="small text-muted">{column.dataType}{column.isNullable ? ' · nullable' : ' · required'}</div></div>)}{!definition.table && <div className="card-body text-muted small">เลือก Table จากแท็บฐานข้อมูล</div>}</div></section><section className="card shadow-sm"><div className="card-header"><Layers3 size={15} className="me-2 text-primary"/><b>Components ที่อ้างอิง ({componentReferences.length})</b></div><div className="list-group list-group-flush overflow-auto" style={{ maxHeight: 330 }}>{componentReferences.map((component) => <button key={component.id} className="list-group-item list-group-item-action text-start" disabled={component.componentType !== 'FormComponent'} onClick={() => setPreviewReference(component)}><div className="d-flex align-items-center"><div><div className="fw-semibold small">{component.name}</div><code className="small">{component.componentType}</code>{component.pages?.length ? <div className="small text-muted">Page: {component.pages.map((page) => page.title).join(', ')}</div> : null}</div>{component.componentType === 'FormComponent' && <Eye size={15} className="ms-auto text-primary"/>}</div></button>)}{!componentReferences.length && <div className="card-body text-muted small">ยังไม่มี Component อ้างอิง Collection นี้</div>}</div></section></div></div></main>
    </div>
    {previewReference && <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center p-4" style={{ zIndex: 1080 }} onClick={() => setPreviewReference(null)}><div className="bg-light rounded shadow-lg overflow-auto" style={{ width: 'min(900px, 95vw)', maxHeight: '90vh' }} onClick={(event) => event.stopPropagation()}><div className="bg-white border-bottom p-3 d-flex align-items-center"><div><b>Preview แบบ Read-only · {previewReference.name}</b><div className="small text-muted">{previewReference.key}</div></div><button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setPreviewReference(null)}><X size={15}/> ปิด</button></div><div className="p-4"><FormComponent title={typeof previewReference.definition.title === 'string' ? previewReference.definition.title : previewReference.name} description={typeof previewReference.definition.description === 'string' ? previewReference.definition.description : undefined} collectionId={collectionKey} fields={previewFields} mode="readOnly" /></div></div></div>}
  </div>;
}
