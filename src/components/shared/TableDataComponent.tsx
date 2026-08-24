'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, FilePlus2, Pencil, Search, Trash2 } from 'lucide-react';

export interface TableColumn { key: string; label: string; sortable?: boolean; filter?: boolean; width?: number | string; align?: 'left' | 'center' | 'right'; format?: 'number' | 'date'; render?: (row: any) => React.ReactNode; }
type StyleMap = React.CSSProperties;
export interface DynamicTableStyle { name?: string; sourceFile?: string; sourceSelectors?: string[]; tokens?: Record<string, string>; card?: StyleMap; header?: StyleMap; title?: StyleMap; createButton?: StyleMap; tableHead?: StyleMap; tableCell?: StyleMap; filterInput?: StyleMap; rowHoverBackground?: string; actionButtons?: Record<string, StyleMap>; }
interface RowAction { id: string; label?: string; variant?: 'view' | 'edit' | 'delete' | string; }
export interface TableDataProps { title?: string; titleIcon?: string; createLabel?: string; columns: TableColumn[]; data: Array<Record<string, any>>; searchable?: boolean; columnFilters?: boolean; pageSize?: number; onRowClick?: (row: any) => void; onAction?: (actionId: string, row?: any) => void; rowActions?: RowAction[]; actions?: Array<{ label: string; variant?: string; onClick: (row: any) => void }>; actionLabel?: string; dynamicStyle?: DynamicTableStyle; className?: string; }

const actionIcon = (variant?: string) => variant === 'delete' ? <Trash2 size={15} /> : variant === 'edit' ? <Pencil size={15} /> : <Eye size={15} />;

export const TableDataComponent: React.FC<TableDataProps> = ({ title, titleIcon, createLabel, columns = [], data = [], searchable = true, columnFilters = false, pageSize = 5, onRowClick, onAction, rowActions = [], actions = [], actionLabel = 'จัดการ', dynamicStyle = {}, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const hasActions = rowActions.length > 0 || actions.length > 0;
  const processedData = useMemo(() => {
    let result = [...data];
    if (searchTerm) { const term = searchTerm.toLowerCase(); result = result.filter((row) => Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(term))); }
    Object.entries(filters).forEach(([key, value]) => { if (value) result = result.filter((row) => String(row[key] ?? '').toLowerCase().includes(value.toLowerCase())); });
    if (sortKey) result.sort((a, b) => a[sortKey] < b[sortKey] ? (sortDir === 'asc' ? -1 : 1) : a[sortKey] > b[sortKey] ? (sortDir === 'asc' ? 1 : -1) : 0);
    return result;
  }, [data, searchTerm, filters, sortKey, sortDir]);
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;
  const paginatedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const handleSort = (key: string) => { if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const formatValue = (value: unknown, format?: TableColumn['format']) => { if (format === 'number') return Number(value || 0).toLocaleString('th-TH'); if (format === 'date' && value) return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value))); return String(value ?? ''); };
  const tokenStyle = Object.fromEntries(Object.entries(dynamicStyle.tokens || {}).map(([k, v]) => [`--dynamic-${k}`, v])) as React.CSSProperties;
  return <div className={`dynamic-table card bg-white p-0 overflow-hidden ${className}`} style={{ ...tokenStyle, ...dynamicStyle.card }} data-style-name={dynamicStyle.name} data-style-source={dynamicStyle.sourceFile}>
    <div className="d-flex justify-content-between align-items-center" style={dynamicStyle.header}>
      {title && <h5 className="fw-semibold mb-0 d-flex align-items-center gap-2" style={dynamicStyle.title}>{titleIcon && <span>{titleIcon}</span>}{title}</h5>}
      <div className="d-flex align-items-center gap-2 ms-auto">{searchable && <div className="input-group" style={{ maxWidth: 260 }}><span className="input-group-text bg-light border-end-0"><Search size={16} /></span><input className="form-control bg-light border-start-0 ps-0" placeholder="ค้นหา..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div>}{createLabel && <button type="button" className="btn d-inline-flex align-items-center gap-2" style={dynamicStyle.createButton} onClick={() => onAction?.('create')}><FilePlus2 size={16} />{createLabel}</button>}</div>
    </div>
    <div className="table-responsive"><table className="table align-middle mb-0"><thead>
      <tr style={dynamicStyle.tableHead}>{columns.map((col) => <th key={col.key} style={{ ...dynamicStyle.tableHead, width: col.width, textAlign: col.align, cursor: col.sortable ? 'pointer' : 'default' }} onClick={() => col.sortable && handleSort(col.key)}><span className="d-inline-flex align-items-center gap-1">{col.label}{col.sortable && sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</span></th>)}{hasActions && <th style={{ ...dynamicStyle.tableHead, textAlign: 'center' }}>{actionLabel}</th>}</tr>
      {columnFilters && <tr>{columns.map((col) => <th key={col.key} style={dynamicStyle.tableCell}>{col.filter && <input className="form-control form-control-sm" style={dynamicStyle.filterInput} value={filters[col.key] || ''} onChange={(e) => { setFilters((old) => ({ ...old, [col.key]: e.target.value })); setCurrentPage(1); }} />}</th>)}{hasActions && <th />}</tr>}
    </thead><tbody>{paginatedData.length ? paginatedData.map((row, rIdx) => <tr key={row.id || rIdx} style={{ cursor: onRowClick ? 'pointer' : 'default' }} onMouseEnter={(e) => { if (dynamicStyle.rowHoverBackground) e.currentTarget.style.background = dynamicStyle.rowHoverBackground; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }} onClick={() => onRowClick?.(row)}>{columns.map((col) => <td key={col.key} style={{ ...dynamicStyle.tableCell, textAlign: col.align }}>{col.render ? col.render(row) : formatValue(row[col.key], col.format)}</td>)}{hasActions && <td style={{ ...dynamicStyle.tableCell, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}><div className="d-inline-flex align-items-center gap-2">{rowActions.map((act) => <button key={act.id} type="button" title={act.label} aria-label={act.label || act.id} className="btn p-0 d-inline-flex align-items-center justify-content-center" style={dynamicStyle.actionButtons?.[act.variant || act.id]} onClick={() => onAction?.(act.id, row)}>{actionIcon(act.variant)}</button>)}{actions.map((act, i) => <button key={i} className={`btn btn-sm btn-${act.variant || 'outline-primary'}`} onClick={() => act.onClick(row)}>{act.label}</button>)}</div></td>}</tr>) : <tr><td colSpan={columns.length + (hasActions ? 1 : 0)} className="text-center py-4 text-muted">ไม่พบข้อมูล</td></tr>}</tbody></table></div>
    <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top"><small className="text-muted">แสดง {paginatedData.length} จาก {processedData.length} รายการ</small><div className="btn-group btn-group-sm"><button className="btn btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</button><span className="btn btn-light disabled">{currentPage} / {totalPages}</span><button className="btn btn-outline-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>ถัดไป</button></div></div>
  </div>;
};
