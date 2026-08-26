import type { Pool } from 'pg';
import { getTenantDb } from './tenantDb';
import type { TenantRecordPage, TenantTableColumn, TenantTableSchema } from '@/types';

/**
 * CRUD over a tenant database's business tables.
 *
 * Table and column names cannot be parameterised in SQL, so every identifier is
 * resolved against `information_schema` for the *tenant's own* database before
 * it is quoted into a statement. An identifier that does not exist there is
 * rejected — this is what keeps the endpoint from becoming an injection hole.
 */

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_LIMIT = 200;

export class TenantRecordError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'TenantRecordError';
  }
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary: boolean;
}

async function describeTable(pool: Pool, table: string): Promise<TenantTableColumn[]> {
  if (!IDENTIFIER.test(table)) throw new TenantRecordError(`ชื่อตารางไม่ถูกต้อง: ${table}`);

  const result = await pool.query<ColumnRow>(
    `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
            COALESCE(pk.is_primary, FALSE) AS is_primary
     FROM information_schema.columns c
     LEFT JOIN (
       SELECT kcu.column_name, TRUE AS is_primary
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = $1
         AND tc.constraint_type = 'PRIMARY KEY'
     ) pk ON pk.column_name = c.column_name
     WHERE c.table_schema = 'public' AND c.table_name = $1
     ORDER BY c.ordinal_position`,
    [table],
  );

  if (!result.rowCount) throw new TenantRecordError(`ไม่พบตาราง '${table}' ใน Tenant Database`, 404);

  return result.rows.map((row) => ({
    columnName: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 'YES',
    isPrimaryKey: row.is_primary,
    defaultValue: row.column_default,
  }));
}

function primaryKeyOf(columns: TenantTableColumn[]): string {
  const key = columns.find((column) => column.isPrimaryKey) ?? columns.find((column) => column.columnName === 'id');
  if (!key) throw new TenantRecordError('ตารางนี้ไม่มี Primary Key จึงแก้ไขรายรายการไม่ได้', 409);
  return key.columnName;
}

/** Keeps only keys that exist as real columns, dropping generated ones. */
function pickWritableColumns(
  payload: Record<string, unknown>,
  columns: TenantTableColumn[],
  primaryKey: string,
): Array<[string, unknown]> {
  const writable = new Map(columns.map((column) => [column.columnName, column]));
  return Object.entries(payload).filter(([key]) => {
    if (!writable.has(key)) return false;
    if (key === primaryKey) return false;
    return key !== 'created_at';
  });
}

export async function listTenantTables(platformId: string): Promise<TenantTableSchema[]> {
  const { pool } = await getTenantDb(platformId);
  const tables = await pool.query<{ table_name: string; row_estimate: string }>(
    `SELECT t.table_name,
            COALESCE(s.n_live_tup, 0)::text AS row_estimate
     FROM information_schema.tables t
     LEFT JOIN pg_stat_user_tables s
       ON s.schemaname = 'public' AND s.relname = t.table_name
     WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     ORDER BY t.table_name`,
  );

  return Promise.all(
    tables.rows.map(async (row) => ({
      tableName: row.table_name,
      columns: await describeTable(pool, row.table_name),
      rowCount: Number(row.row_estimate),
    })),
  );
}

export async function describeTenantTable(platformId: string, table: string): Promise<TenantTableSchema> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public.${quote(table)}`);
  return { tableName: table, columns, rowCount: Number(count.rows[0].count) };
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string>;
}

export async function listTenantRecords(
  platformId: string,
  table: string,
  options: ListOptions = {},
): Promise<TenantRecordPage> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const columnNames = new Set(columns.map((column) => column.columnName));

  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    if (!columnNames.has(key)) continue;
    params.push(value);
    conditions.push(`${quote(key)}::text = $${params.length}`);
  }

  if (options.search) {
    const textColumns = columns
      .filter((column) => /char|text|json/.test(column.dataType))
      .map((column) => quote(column.columnName));
    if (textColumns.length) {
      params.push(`%${options.search}%`);
      const placeholder = `$${params.length}`;
      conditions.push(`(${textColumns.map((column) => `${column}::text ILIKE ${placeholder}`).join(' OR ')})`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderColumn = options.orderBy && columnNames.has(options.orderBy)
    ? options.orderBy
    : primaryKeyOf(columns);
  const direction = options.direction === 'asc' ? 'ASC' : 'DESC';

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.${quote(table)} ${where}`,
    params,
  );

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT * FROM public.${quote(table)} ${where}
     ORDER BY ${quote(orderColumn)} ${direction}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    table,
    columns: columns.map((column) => column.columnName),
    rows: rows.rows,
    total: Number(totalResult.rows[0].count),
    limit,
    offset,
  };
}

export async function getTenantRecord(
  platformId: string,
  table: string,
  id: string,
): Promise<Record<string, unknown>> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const primaryKey = primaryKeyOf(columns);

  const result = await pool.query(
    `SELECT * FROM public.${quote(table)} WHERE ${quote(primaryKey)}::text = $1 LIMIT 1`,
    [id],
  );
  if (!result.rowCount) throw new TenantRecordError('ไม่พบข้อมูลที่ระบุ', 404);
  return result.rows[0];
}

export async function insertTenantRecord(
  platformId: string,
  table: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const primaryKey = primaryKeyOf(columns);
  const entries = pickWritableColumns(payload, columns, primaryKey);

  if (!entries.length) throw new TenantRecordError('ไม่มีข้อมูลที่ตรงกับคอลัมน์ของตารางนี้');

  const names = entries.map(([key]) => quote(key)).join(', ');
  const placeholders = entries.map((_entry, index) => `$${index + 1}`).join(', ');

  const result = await pool.query(
    `INSERT INTO public.${quote(table)} (${names}) VALUES (${placeholders}) RETURNING *`,
    entries.map(([, value]) => value),
  );
  return result.rows[0];
}

export async function updateTenantRecord(
  platformId: string,
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const primaryKey = primaryKeyOf(columns);
  const entries = pickWritableColumns(payload, columns, primaryKey);

  if (!entries.length) throw new TenantRecordError('ไม่มีข้อมูลที่ตรงกับคอลัมน์ของตารางนี้');

  const assignments = entries.map(([key], index) => `${quote(key)} = $${index + 1}`);
  if (columns.some((column) => column.columnName === 'updated_at')) {
    assignments.push('updated_at = now()');
  }

  const result = await pool.query(
    `UPDATE public.${quote(table)} SET ${assignments.join(', ')}
     WHERE ${quote(primaryKey)}::text = $${entries.length + 1} RETURNING *`,
    [...entries.map(([, value]) => value), id],
  );
  if (!result.rowCount) throw new TenantRecordError('ไม่พบข้อมูลที่ต้องการแก้ไข', 404);
  return result.rows[0];
}

export async function deleteTenantRecord(platformId: string, table: string, id: string): Promise<boolean> {
  const { pool } = await getTenantDb(platformId);
  const columns = await describeTable(pool, table);
  const primaryKey = primaryKeyOf(columns);

  const result = await pool.query(
    `DELETE FROM public.${quote(table)} WHERE ${quote(primaryKey)}::text = $1`,
    [id],
  );
  if (!result.rowCount) throw new TenantRecordError('ไม่พบข้อมูลที่ต้องการลบ', 404);
  return true;
}
