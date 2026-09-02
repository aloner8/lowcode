import 'server-only';
import type { Pool } from 'pg';
import { getAppTenantDb, getTenantDb } from '@/lib/db/tenantDb';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const OPERATORS: Record<string, string> = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', contains: 'ILIKE', in: '= ANY' };

async function poolFor(ctx: ServiceExecutionContext): Promise<Pool> {
  return ctx.scope.appId ? (await getAppTenantDb(ctx.scope.appId)).pool : (await getTenantDb(ctx.scope.platformId)).pool;
}

async function columnsFor(pool: Pool, table: string): Promise<string[]> {
  if (!IDENTIFIER.test(table)) throw new ServiceError('SERVICE_INPUT_INVALID', 'Invalid collection table', 400);
  const result = await pool.query<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', ['public', table]);
  if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', `Collection table '${table}' was not found`, 404);
  return result.rows.map((row) => row.column_name);
}

const permittedFields = (configured: unknown, columns: string[]) => {
  const list = Array.isArray(configured) ? configured.map(String) : [];
  return list.includes('*') ? columns : list.filter((field) => columns.includes(field));
};

export async function executeCollectionService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  const pool = await poolFor(ctx);
  const table = String(binding.config.table || '');
  const columns = await columnsFor(pool, table);
  const readable = permittedFields(binding.config.readableFields, columns);
  const writable = permittedFields(binding.config.writableFields, columns).filter((field) => field !== 'id' && field !== 'created_at');
  const primaryKey = columns.includes('id') ? 'id' : columns[0];
  if (!readable.length && ['list', 'get', 'count'].includes(operation)) throw new ServiceError('PERMISSION_DENIED', 'No readable fields are configured', 403);

  if (operation === 'list' || operation === 'count') {
    const allowedFilters = new Set((Array.isArray(binding.config.allowedFilters) ? binding.config.allowedFilters : []).map(String));
    const conditions: string[] = []; const params: unknown[] = [];
    for (const filter of Array.isArray(input.filter) ? input.filter : []) {
      const field = String(filter?.field || ''); const op = String(filter?.op || '');
      if (!columns.includes(field) || !allowedFilters.has(`${field}:${op}`) || !OPERATORS[op]) throw new ServiceError('SERVICE_INPUT_INVALID', `Filter '${field}:${op}' is not allowed`, 400);
      params.push(op === 'contains' ? `%${String(filter.value ?? '')}%` : op === 'in' ? (Array.isArray(filter.value) ? filter.value.map(String) : []) : filter.value);
      conditions.push(op === 'in' ? `${quote(field)}::text = ANY($${params.length}::text[])` : `${quote(field)}${op === 'contains' ? '::text' : ''} ${OPERATORS[op]} $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public.${quote(table)} ${where}`, params);
    if (operation === 'count') return { count: Number(count.rows[0].count) };
    const requested = Array.isArray(input.select) ? input.select.map(String).filter((field: string) => readable.includes(field)) : readable;
    if (!requested.length) throw new ServiceError('SERVICE_INPUT_INVALID', 'No permitted fields were selected', 400);
    const limit = Math.min(Math.max(Number(input.page?.limit || 20), 1), Number(binding.config.maxPageSize || 100));
    const offset = Math.max(Number(input.page?.offset || 0), 0);
    const sortText = String(input.sort?.[0]?.field || binding.config.defaultSort || primaryKey).split(/\s+/)[0];
    const sortField = readable.includes(sortText) ? sortText : primaryKey;
    const direction = String(input.sort?.[0]?.direction || binding.config.defaultSort || '').toLowerCase().includes('asc') ? 'ASC' : 'DESC';
    params.push(limit, offset);
    const rows = await pool.query(`SELECT ${requested.map(quote).join(',')} FROM public.${quote(table)} ${where} ORDER BY ${quote(sortField)} ${direction} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { rows: rows.rows, total: Number(count.rows[0].count), limit, offset };
  }

  if (operation === 'get') {
    const result = await pool.query(`SELECT ${readable.map(quote).join(',')} FROM public.${quote(table)} WHERE ${quote(primaryKey)}::text=$1 LIMIT 1`, [String(input.id || '')]);
    if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Record not found', 404);
    return { record: result.rows[0] };
  }

  if (operation === 'create' || operation === 'update') {
    const source = input.data && typeof input.data === 'object' ? input.data as Record<string, unknown> : {};
    const entries = Object.entries(source).filter(([field]) => writable.includes(field));
    if (!entries.length) throw new ServiceError('SERVICE_INPUT_INVALID', 'No writable fields were supplied', 400);
    if (operation === 'create') {
      const result = await pool.query(`INSERT INTO public.${quote(table)} (${entries.map(([field]) => quote(field)).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${readable.map(quote).join(',')}`, entries.map(([, value]) => value));
      return { record: result.rows[0] };
    }
    const values = entries.map(([, value]) => value); values.push(String(input.id || ''));
    const result = await pool.query(`UPDATE public.${quote(table)} SET ${entries.map(([field], i) => `${quote(field)}=$${i + 1}`).join(',')} WHERE ${quote(primaryKey)}::text=$${values.length} RETURNING ${readable.map(quote).join(',')}`, values);
    if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Record not found', 404);
    return { record: result.rows[0] };
  }

  if (operation === 'delete') {
    const result = await pool.query(`DELETE FROM public.${quote(table)} WHERE ${quote(primaryKey)}::text=$1`, [String(input.id || '')]);
    if (!result.rowCount) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Record not found', 404);
    return { deleted: true };
  }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported data operation '${operation}'`, 405);
}
