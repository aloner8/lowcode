'use client';

import React, { useState } from 'react';
import { DbTableDefinition, ComponentNode } from '@/types';
import { Database, Table, Plus, Zap, CheckCircle2, ChevronRight, ChevronDown, Layers, Sparkles } from 'lucide-react';

interface DbSchemaExplorerProps {
  tenantDbName: string;
  onGenerateComponent: (newNode: ComponentNode) => void;
}

export const DbSchemaExplorer: React.FC<DbSchemaExplorerProps> = ({
  tenantDbName,
  onGenerateComponent,
}) => {
  const [openTable, setOpenTable] = useState<string | null>('users');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mock Tenant DB Schema Definitions for app_db_client_a
  const mockTables: DbTableDefinition[] = [
    {
      tableName: 'users',
      rowCount: 42,
      columns: [
        { columnName: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { columnName: 'full_name', dataType: 'varchar', isNullable: false },
        { columnName: 'email', dataType: 'varchar', isNullable: false },
        { columnName: 'role', dataType: 'varchar', isNullable: false },
        { columnName: 'created_at', dataType: 'timestamp', isNullable: true },
      ],
    },
    {
      tableName: 'leads',
      rowCount: 128,
      columns: [
        { columnName: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { columnName: 'client_name', dataType: 'varchar', isNullable: false },
        { columnName: 'phone', dataType: 'varchar', isNullable: true },
        { columnName: 'company', dataType: 'varchar', isNullable: true },
        { columnName: 'status', dataType: 'varchar', isNullable: false },
      ],
    },
    {
      tableName: 'orders',
      rowCount: 256,
      columns: [
        { columnName: 'id', dataType: 'uuid', isNullable: false, isPrimaryKey: true },
        { columnName: 'order_number', dataType: 'varchar', isNullable: false },
        { columnName: 'total_amount', dataType: 'integer', isNullable: false },
        { columnName: 'is_paid', dataType: 'boolean', isNullable: false },
      ],
    },
  ];

  // Generate TableDataComponent from DB Table Schema
  const handleGenerateTableComponent = (table: DbTableDefinition) => {
    const columns = table.columns.map((col) => ({
      key: col.columnName,
      label: col.columnName.replace(/_/g, ' ').toUpperCase(),
      sortable: true,
    }));

    const mockDataRow: Record<string, any> = {};
    table.columns.forEach((col) => {
      if (col.columnName === 'id') mockDataRow['id'] = '001';
      else if (col.columnName.includes('name')) mockDataRow[col.columnName] = 'Siam Enterprise';
      else if (col.columnName.includes('email')) mockDataRow[col.columnName] = 'contact@siam.co.th';
      else if (col.dataType === 'integer') mockDataRow[col.columnName] = 12500;
      else if (col.dataType === 'boolean') mockDataRow[col.columnName] = true;
      else mockDataRow[col.columnName] = 'Active';
    });

    const newNode: ComponentNode = {
      id: `node_table_${table.tableName}_${Date.now()}`,
      type: 'TableDataComponent',
      props: {
        title: `Tenant DB Table: ${table.tableName}`,
        columns: columns,
        data: [mockDataRow],
      },
    };

    onGenerateComponent(newNode);
    setSuccessMsg(`Generated TableDataComponent from '${table.tableName}'!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Generate FormComponent from DB Table Schema
  const handleGenerateFormComponent = (table: DbTableDefinition) => {
    const fields = table.columns
      .filter((col) => !col.isPrimaryKey && col.columnName !== 'created_at')
      .map((col) => ({
        name: col.columnName,
        label: col.columnName.replace(/_/g, ' ').toUpperCase(),
        type: col.columnName.includes('email') ? 'email' : col.dataType === 'integer' ? 'number' : 'text',
        placeholder: `Enter ${col.columnName}...`,
        required: !col.isNullable,
      }));

    const newNode: ComponentNode = {
      id: `node_form_${table.tableName}_${Date.now()}`,
      type: 'FormComponent',
      props: {
        title: `Add New ${table.tableName.slice(0, -1).toUpperCase()}`,
        description: `Auto-generated form bound to Tenant DB table '${table.tableName}'`,
        submitText: 'Save Record',
        fields: fields,
      },
    };

    onGenerateComponent(newNode);
    setSuccessMsg(`Generated FormComponent from '${table.tableName}'!`);
    setTimeout(() => setSuccessMsg(null), 3000);
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
        {successMsg && (
          <span className="badge bg-success text-white extra-small d-flex align-items-center gap-1">
            <CheckCircle2 size={12} /> {successMsg}
          </span>
        )}
      </div>

      <div className="d-flex flex-column gap-2">
        {mockTables.map((table) => {
          const isOpen = openTable === table.tableName;
          return (
            <div key={table.tableName} className="border rounded-2 p-2 bg-light">
              <div
                className="d-flex align-items-center justify-content-between cursor-pointer"
                onClick={() => setOpenTable(isOpen ? null : table.tableName)}
              >
                <div className="d-flex align-items-center gap-2 text-dark font-monospace extra-small fw-bold">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Table size={14} className="text-primary" />
                  <span>{table.tableName}</span>
                </div>
                <span className="badge bg-secondary bg-opacity-20 text-secondary extra-small" style={{ fontSize: '0.62rem' }}>
                  {table.rowCount} rows ({table.columns.length} cols)
                </span>
              </div>

              {isOpen && (
                <div className="mt-2 pt-2 border-top">
                  {/* Columns List */}
                  <div className="d-flex flex-column gap-1 mb-2 px-1">
                    {table.columns.map((col) => (
                      <div key={col.columnName} className="d-flex align-items-center justify-content-between extra-small font-monospace text-secondary" style={{ fontSize: '0.7rem' }}>
                        <span>
                          {col.isPrimaryKey && <span className="text-warning fw-bold me-1">🔑</span>}
                          {col.columnName}
                        </span>
                        <span className="badge bg-white border text-dark" style={{ fontSize: '0.6rem' }}>
                          {col.dataType}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* One-Click Generator Action Buttons */}
                  <div className="d-flex gap-1 pt-1">
                    <button
                      className="btn btn-sm btn-primary flex-grow-1 extra-small py-1 d-flex align-items-center justify-content-center gap-1"
                      onClick={() => handleGenerateTableComponent(table)}
                      style={{ fontSize: '0.72rem' }}
                    >
                      <Sparkles size={12} /> Auto Table
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary flex-grow-1 extra-small py-1 d-flex align-items-center justify-content-center gap-1"
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
