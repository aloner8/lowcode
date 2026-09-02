import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

vi.mock('server-only', () => ({}));

import { createOrReplaceCollectionProcedure } from '@/lib/db/collectionProcedure';

const schemaRows = [
  { column_name: 'id', formatted_type: 'bigint', column_default: "nextval('users_id_seq'::regclass)", is_identity: 'NO', is_generated: 'NEVER', is_primary: true },
  { column_name: 'email', formatted_type: 'character varying(255)', column_default: null, is_identity: 'NO', is_generated: 'NEVER', is_primary: false },
  { column_name: 'updated_at', formatted_type: 'timestamp with time zone', column_default: 'now()', is_identity: 'NO', is_generated: 'NEVER', is_primary: false },
];

function pool() {
  const queries: string[] = [];
  return {
    queries,
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return queries.length === 1 ? { rowCount: schemaRows.length, rows: schemaRows } : { rowCount: null, rows: [] };
    }),
  };
}

describe('collection procedure generator', () => {
  it.each([
    ['POST', 'users_create', 'INSERT INTO public."users"'],
    ['PATCH', 'users_update', 'UPDATE public."users"'],
    ['DELETE', 'users_delete', 'DELETE FROM public."users"'],
    ['GET', 'users_list', 'jsonb_agg'],
  ] as const)('generates an executable-shaped %s procedure', async (method, procedure, expectedSql) => {
    const target = pool();
    const result = await createOrReplaceCollectionProcedure(target as never, 'users', { id: method.toLowerCase(), method, procedure });
    expect(target.query).toHaveBeenCalledTimes(2);
    expect(result.sql).toContain(`CREATE OR REPLACE PROCEDURE public."${procedure}"`);
    expect(result.sql).toContain(expectedSql);
    expect(result.sql).toContain("jsonb_build_object('status'");
    expect(result.signature).toContain('json_input jsonb');
  });

  it('rejects identifiers before executing generated SQL', async () => {
    const target = pool();
    await expect(createOrReplaceCollectionProcedure(target as never, 'users;drop table users', { id: 'create', method: 'POST', procedure: 'bad' })).rejects.toThrow('Table must use');
    expect(target.query).not.toHaveBeenCalled();
  });

  it.runIf(Boolean(process.env.COLLECTION_PROCEDURE_TEST_DATABASE_URL))('creates and calls procedures in PostgreSQL', async () => {
    const database = new Pool({ connectionString: process.env.COLLECTION_PROCEDURE_TEST_DATABASE_URL });
    const suffix = Date.now().toString(36);
    const table = `codex_proc_${suffix}`;
    const create = `${table}_create`, update = `${table}_update`, remove = `${table}_delete`;
    try {
      await database.query(`CREATE TABLE public."${table}" (id bigserial PRIMARY KEY, email varchar(255) NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
      await createOrReplaceCollectionProcedure(database, table, { id: 'create', method: 'POST', procedure: create });
      const inserted = await database.query(`CALL public."${create}"($1::jsonb, NULL::jsonb)`, [JSON.stringify({ data: { email: 'created@example.com' } })]);
      expect(inserted.rows[0].json_out).toMatchObject({ status: 'success', id: '1' });
      await createOrReplaceCollectionProcedure(database, table, { id: 'update', method: 'PATCH', procedure: update });
      const updated = await database.query(`CALL public."${update}"($1::jsonb, NULL::jsonb)`, [JSON.stringify({ id: 1, data: { email: 'updated@example.com' } })]);
      expect(updated.rows[0].json_out.status).toBe('success');
      await createOrReplaceCollectionProcedure(database, table, { id: 'delete', method: 'DELETE', procedure: remove });
      const deleted = await database.query(`CALL public."${remove}"($1::jsonb, NULL::jsonb)`, [JSON.stringify({ id: 1 })]);
      expect(deleted.rows[0].json_out.status).toBe('success');
    } finally {
      await database.query(`DROP PROCEDURE IF EXISTS public."${create}"(jsonb, jsonb)`);
      await database.query(`DROP PROCEDURE IF EXISTS public."${update}"(jsonb, jsonb)`);
      await database.query(`DROP PROCEDURE IF EXISTS public."${remove}"(jsonb, jsonb)`);
      await database.query(`DROP TABLE IF EXISTS public."${table}"`);
      await database.end();
    }
  });
});
