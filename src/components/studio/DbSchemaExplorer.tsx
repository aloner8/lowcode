'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ComponentNode, TenantTableSchema } from '@/types';
import { Database, Table, Plus, CheckCircle2, ChevronRight, ChevronDown, Sparkles, RefreshCw } from 'lucide-react';

interface DbSchemaExplorerProps {
  readonly platformId: string;
  readonly tenantDbName: string;
  readonly onGenerateComponent: (newNode: ComponentNode) => void;
}

/** Maps a Postgres type onto the input type used by FieldInputComponent. */
function inputTypeFor(columnName: string, dataType: string): string {
  if (columnName.includes('email')) return 'email';
  if (/int|numeric|decimal|double|real/.test(dataType)) return 'number';
  if (/timestamp|date/.test(dataType)) return 'date';
  if (dataType === 'boolean') return 'checkbox';
  if (/text|json/.test(dataType)) return 'textarea';
  return 'text';
}

/**
 * Browses the live schema of a platform's tenant database and generates
 * Table/Form components bound to a real table.
 */
export const DbSchemaExplorer: React.FC<DbSchemaExplorerProps> = ({
  platformId,
  tenantDbName,
  onGenerateComponent,
}) => {
  const [tables, setTables] = useState<TenantTableSchema[]>([]);
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/platforms/${platformId}/database/tables`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถอ่านโครงสร้างฐานข้อมูลได้');
      setTables(payload.tables as TenantTableSchema[]);
      setOpenTable((current) => current ?? payload.tables?.[0]?.tableName ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านโครงสร้างฐานข้อมูลได้');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [platformId]);

  useEffect(() => {
    void loadSchema();
  }, [loadSchema]);

  const flash = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleGenerateTableComponent = (table: TenantTableSchema) => {
    onGenerateComponent({
      id: `node_table_${table.tableName}_${Date.now()}`,
      type: 'TableDataComponent',
      props: {
        title: table.tableName.replace(/_/g, ' '),
        // Bound to the real table; rows are fetched at runtime, not embedded.
        dataSource: { table: table.tableName },
        columns: table.columns.map((column) => ({
          key: column.columnName,
          label: column.columnName.replace(/_/g, ' ').toUpperCase(),
          sortable: true,
        })),
        data: [],
      },
    });
    flash(`สร้าง TableDataComponent จาก '${table.tableName}' แล้ว`);
  };

  const handleGenerateFormComponent = (table: TenantTableSchema) => {
    const fields = table.columns
      .filter((column) => !column.isPrimaryKey && !['created_at', 'updated_at'].includes(column.columnName))
      .map((column) => ({
        name: column.columnName,
        label: column.columnName.replace(/_/g, ' ').toUpperCase(),
        type: inputTypeFor(column.columnName, column.dataType),
        placeholder: `กรอก ${column.columnName}…`,
        required: !column.isNullable,
      }));

    onGenerateComponent({
      id: `node_form_${table.tableName}_${Date.now()}`,
      type: 'FormComponent',
      actionTriggerId: 'submit',
      props: {
        title: `เพิ่มข้อมูล ${table.tableName.replace(/_/g, ' ')}`,
        description: `ผูกกับตาราง '${table.tableName}' ใน Tenant Database`,
        submitText: 'บันทึก',
        dataSource: { table: table.tableName },
        fields,
      },
    });
    flash(`สร้าง FormComponent จาก '${table.tableName}' แล้ว`);
  };

  return (
    <div className="card border rounded-3 p-3 bg-white shadow-sm">
      <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
        <div className="d-flex align-items-center gap-2">
          <Database size={20} className="text-warning" />
          <div>
            <h6 className="fw-bold mb-0 text-dark small">Tenant DB Schema Explorer</h6>
            <div className="extra-small text-muted font-monospace" style={{ fontSize: '0.68rem' }}>
              Database: <code>{tenantDbName}</code>
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {successMsg && (
            <span className="badge bg-success text-white extra-small d-flex align-items-center gap-1">
              <CheckCircle2 size={12} /> {successMsg}
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary py-0 px-2"
            onClick={() => void loadSchema()}
            disabled={loading}
            aria-label="โหลดโครงสร้างใหม่"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warning border-0 py-2 small mb-2">{error}</div>}

      {loading && tables.length === 0 && (
        <div className="text-center text-muted small py-3">
          <span className="spinner-border spinner-border-sm me-2" /> กำลังอ่านโครงสร้าง…
        </div>
      )}

      {!loading && tables.length === 0 && !error && (
        <p className="text-muted small mb-0">
          ยังไม่มีตารางใน Tenant Database — กด &ldquo;Publish Database&rdquo; ใน Studio ก่อน
        </p>
      )}

      <div className="d-flex flex-column gap-2">
        {tables.map((table) => {
          const isOpen = openTable === table.tableName;
          return (
            <div key={table.tableName} className="border rounded-2 p-2 bg-light">
              <button
                type="button"
                className="btn btn-link p-0 w-100 text-decoration-none d-flex align-items-center justify-content-between"
                onClick={() => setOpenTable(isOpen ? null : table.tableName)}
                aria-expanded={isOpen}
              >
                <span className="d-flex align-items-center gap-2 text-dark font-monospace extra-small fw-bold">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Table size={14} className="text-primary" />
                  {table.tableName}
                </span>
                <span className="badge bg-secondary bg-opacity-25 text-secondary extra-small" style={{ fontSize: '0.62rem' }}>
                  {table.rowCount} rows ({table.columns.length} cols)
                </span>
              </button>

              {isOpen && (
                <div className="mt-2 pt-2 border-top">
                  <div className="d-flex flex-column gap-1 mb-2 px-1">
                    {table.columns.map((column) => (
                      <div
                        key={column.columnName}
                        className="d-flex align-items-center justify-content-between extra-small font-monospace text-secondary"
                        style={{ fontSize: '0.7rem' }}
                      >
                        <span>
                          {column.isPrimaryKey && <span className="text-warning fw-bold me-1">🔑</span>}
                          {column.columnName}
                          {!column.isNullable && <span className="text-danger ms-1">*</span>}
                        </span>
                        <span className="badge bg-white border text-dark" style={{ fontSize: '0.6rem' }}>
                          {column.dataType}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="d-flex gap-1 pt-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary flex-grow-1 py-1 d-flex align-items-center justify-content-center gap-1"
                      onClick={() => handleGenerateTableComponent(table)}
                      style={{ fontSize: '0.72rem' }}
                    >
                      <Sparkles size={12} /> Auto Table
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary flex-grow-1 py-1 d-flex align-items-center justify-content-center gap-1"
                      onClick={() => handleGenerateFormComponent(table)}
                      style={{ fontSize: '0.72rem' }}
                    >
                      <Plus size={12} /> Auto Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
