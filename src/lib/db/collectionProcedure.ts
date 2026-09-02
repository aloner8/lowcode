import 'server-only';

import type { Pool } from 'pg';

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

type ProcedureColumn = {
  column_name: string;
  formatted_type: string;
  column_default: string | null;
  is_identity: string;
  is_generated: string;
  is_primary: boolean;
};

export type ProcedureOperation = {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  procedure: string;
};

function assertIdentifier(value: string, label: string) {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} must use lowercase letters, numbers, and underscores`);
  return value;
}

async function columnsFor(pool: Pool, table: string): Promise<ProcedureColumn[]> {
  const result = await pool.query<ProcedureColumn>(
    `SELECT c.column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type,
            c.column_default, c.is_identity, c.is_generated,
            COALESCE(pk.is_primary, FALSE) AS is_primary
     FROM information_schema.columns c
     JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
     JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
     JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
     LEFT JOIN (
       SELECT kcu.column_name, TRUE AS is_primary
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
     ) pk ON pk.column_name = c.column_name
     WHERE c.table_schema = 'public' AND c.table_name = $1
     ORDER BY c.ordinal_position`,
    [table],
  );
  if (!result.rowCount) throw new Error(`Table '${table}' was not found in the selected database`);
  return result.rows;
}

function inputExpression(column: ProcedureColumn) {
  const key = literal(column.column_name);
  const fallback = column.column_default ?? 'NULL';
  return `CASE WHEN v_data ? ${key} THEN NULLIF(v_data->>${key}, '')::${column.formatted_type} ELSE ${fallback} END`;
}

export async function createOrReplaceCollectionProcedure(
  pool: Pool,
  tableValue: string,
  operation: ProcedureOperation,
): Promise<{ procedure: string; sql: string; signature: string }> {
  const table = assertIdentifier(tableValue, 'Table');
  const procedure = assertIdentifier(operation.procedure, 'Procedure name');
  const columns = await columnsFor(pool, table);
  const primary = columns.find((column) => column.is_primary) ?? columns.find((column) => column.column_name === 'id');
  const writable = columns.filter((column) => column.is_identity !== 'YES' && column.is_generated === 'NEVER');
  const mutable = writable.filter((column) => column.column_name !== primary?.column_name && !['created_at', 'updated_at'].includes(column.column_name));
  const tableRef = `public.${quote(table)}`;
  const returnId = primary ? `${quote(primary.column_name)}::text` : 'NULL::text';
  const response = (extra = '') => `jsonb_build_object('status', 'success', 'errorMessage', NULL, 'id', v_id${extra})`;
  let body: string;

  if (operation.method === 'POST') {
    const names = writable.map((column) => quote(column.column_name)).join(', ');
    const values = writable.map(inputExpression).join(', ');
    const insert = writable.length
      ? `INSERT INTO ${tableRef} (${names}) VALUES (${values}) RETURNING ${returnId} INTO v_id;`
      : `INSERT INTO ${tableRef} DEFAULT VALUES RETURNING ${returnId} INTO v_id;`;
    body = `
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    v_data := COALESCE(v_row->'data', v_row);
    ${insert}
  END LOOP;
  json_out := ${response()};`;
  } else if (operation.method === 'PATCH') {
    if (!primary) throw new Error('Update procedure requires a primary key or id column');
    const assignments = mutable.map((column) => {
      const name = quote(column.column_name), key = literal(column.column_name);
      return `${name} = CASE WHEN v_data ? ${key} THEN NULLIF(v_data->>${key}, '')::${column.formatted_type} ELSE ${name} END`;
    });
    if (columns.some((column) => column.column_name === 'updated_at')) assignments.push(`${quote('updated_at')} = now()`);
    if (!assignments.length) throw new Error('Table has no columns that can be updated');
    const pk = quote(primary.column_name), pkKey = literal(primary.column_name);
    body = `
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    v_data := COALESCE(v_row->'data', v_row);
    UPDATE ${tableRef} SET ${assignments.join(', ')}
     WHERE ${pk} = NULLIF(COALESCE(v_row->>'id', v_data->>${pkKey}), '')::${primary.formatted_type}
     RETURNING ${returnId} INTO v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
  END LOOP;
  json_out := ${response()};`;
  } else if (operation.method === 'DELETE') {
    if (!primary) throw new Error('Delete procedure requires a primary key or id column');
    const pk = quote(primary.column_name), pkKey = literal(primary.column_name);
    body = `
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    DELETE FROM ${tableRef}
     WHERE ${pk} = NULLIF(COALESCE(v_row->>'id', v_row->>${pkKey}), '')::${primary.formatted_type}
     RETURNING ${returnId} INTO v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
  END LOOP;
  json_out := ${response()};`;
  } else {
    const inputId = `NULLIF(COALESCE(json_input->>'id', json_input->>${literal(primary?.column_name ?? 'id')}), '')`;
    const where = primary
      ? `WHERE ${inputId} IS NULL OR ${quote(primary.column_name)} = ${inputId}::${primary.formatted_type}`
      : '';
    body = `
  SELECT COALESCE(jsonb_agg(to_jsonb(source_rows)), '[]'::jsonb)
    INTO v_result FROM (SELECT * FROM ${tableRef} ${where} LIMIT 100) source_rows;
  v_id := ${inputId};
  json_out := ${response(", 'data', v_result")};`;
  }

  const sql = `CREATE OR REPLACE PROCEDURE public.${quote(procedure)}(
  IN json_input jsonb,
  INOUT json_out jsonb
)
LANGUAGE plpgsql
AS $collection_procedure$
DECLARE
  v_rows jsonb := CASE WHEN jsonb_typeof(COALESCE(json_input, '{}'::jsonb)) = 'array'
    THEN json_input ELSE jsonb_build_array(COALESCE(json_input, '{}'::jsonb)) END;
  v_row jsonb;
  v_data jsonb;
  v_result jsonb;
  v_id text;
BEGIN${body}
EXCEPTION WHEN OTHERS THEN
  json_out := jsonb_build_object('status', 'error', 'errorMessage', SQLERRM, 'id', v_id);
END;
$collection_procedure$;`;

  await pool.query(sql);
  return { procedure, sql, signature: `${procedure}(json_input jsonb, INOUT json_out jsonb)` };
}
