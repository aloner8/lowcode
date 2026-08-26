import { NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db/tenantDb';
import { requirePlatformSession } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const READ_ONLY_START = /^(select|with|explain)\b/i;
const BLOCKED_SQL = /\b(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|call|do|execute|vacuum|analyze|refresh|reindex|cluster|comment|security|set|reset)\b/i;

function normalizeReadOnlySql(value: unknown): string {
  if (typeof value !== 'string') throw new Error('SQL query is required');
  const sql = value.trim().replace(/;+\s*$/, '');
  if (!sql || sql.length > 20_000) throw new Error('SQL query must contain 1–20,000 characters');
  if (!READ_ONLY_START.test(sql) || BLOCKED_SQL.test(sql)) throw new Error('Only read-only SELECT, WITH, or EXPLAIN queries are allowed');
  if (sql.includes(';')) throw new Error('Only one SQL statement is allowed');
  return sql;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = performance.now();
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'STAFF');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as { sql?: unknown };
    const sql = normalizeReadOnlySql(body.sql);
    const { pool, database } = await getTenantDb(id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query('SET LOCAL search_path TO public');
      const result = await client.query({ text: sql, rowMode: 'array' });
      await client.query('COMMIT');
      return NextResponse.json({
        columns: result.fields.map((field) => field.name), rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        durationMs: Math.round(performance.now() - startedAt), database,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    const isValidationError = /required|characters|read-only|one SQL statement/.test(message);
    return NextResponse.json({ error: message }, { status: isValidationError ? 400 : 500 });
  }
}
