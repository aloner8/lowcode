import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const sourcePath = path.resolve(process.cwd(), 'public/YII/yang.sql');
const coreUrl = process.env.CORE_DATABASE_URL || 'postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core';
const platformSlug = process.argv[2] || 'plateform-obt';
const text = await fs.readFile(sourcePath, 'utf8');
const core = new Pool({ connectionString: coreUrl });
const platform = await core.query('SELECT id, platform_slug FROM public.platforms WHERE platform_slug=$1', [platformSlug]);
if (!platform.rowCount) throw new Error(`Platform not found: ${platformSlug}`);
const platformId = platform.rows[0].id;
const database = `platform_${platformSlug.replace(/-/g, '_')}`;
const tenantConnection = new URL(coreUrl); tenantConnection.pathname = `/${database}`;
const tenant = new Pool({ connectionString: tenantConnection.toString() });
const tablesResult = await tenant.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
const allowed = new Set(tablesResult.rows.map((row) => row.table_name));

const typeMap = (mysql) => {
  const value = mysql.toLowerCase();
  if (/bigint/.test(value)) return 'bigint';
  if (/tinyint\(1\)/.test(value)) return 'boolean';
  if (/int/.test(value)) return 'bigint';
  if (/decimal|double|float/.test(value)) return 'numeric';
  if (/date(?!time)/.test(value)) return 'date';
  if (/datetime|timestamp/.test(value)) return 'timestamptz';
  if (/json/.test(value)) return 'jsonb';
  return 'text';
};

const definitions = new Map();
for (const match of text.matchAll(/CREATE TABLE `([^`]+)`\s*\(([\s\S]*?)\)\s*ENGINE/g)) {
  if (!allowed.has(match[1])) continue;
  const columns = [];
  for (const line of match[2].split(/\r?\n/)) {
    const column = line.match(/^\s*`([^`]+)`\s+([^ ,]+(?:\([^)]*\))?)/);
    if (column) columns.push({ name: column[1], type: typeMap(column[2]) });
  }
  definitions.set(match[1], columns);
}

function parseTuples(input) {
  const rows = []; let row = null; let token = ''; let quoted = false; let escape = false;
  const push = () => { const raw = token.trim(); row.push(quoted ? token : raw.toUpperCase() === 'NULL' ? null : /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw); token = ''; };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) { token += ch === 'n' ? '\n' : ch === 'r' ? '\r' : ch === 't' ? '\t' : ch; escape = false; continue; }
    if (quoted && ch === '\\') { escape = true; continue; }
    if (ch === "'") { if (quoted && input[i + 1] === "'") { token += "'"; i++; } else quoted = !quoted; continue; }
    if (!quoted && ch === '(') { row = []; token = ''; continue; }
    if (!quoted && ch === ',' && row) { push(); continue; }
    if (!quoted && ch === ')' && row) { push(); rows.push(row); row = null; continue; }
    if (row) token += ch;
  }
  return rows;
}

await core.query(await fs.readFile(path.resolve(process.cwd(), 'docker/postgres/migrations/005_create_platform_table_samples.sql'), 'utf8'));
const imported = {};
for (const [table, columns] of definitions) {
  for (const column of columns) await tenant.query(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`);
  const actualColumns = await tenant.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
  const actualTypes = new Map(actualColumns.rows.map((column) => [column.column_name, column.data_type]));
  const insertPattern = new RegExp('INSERT INTO `' + table + '`(?: \\(([^)]*)\\))? VALUES ([\\s\\S]*?);', 'g');
  const samples = []; let count = 0;
  for (const statement of text.matchAll(insertPattern)) {
    const names = statement[1] ? [...statement[1].matchAll(/`([^`]+)`/g)].map((item) => item[1]) : columns.map((column) => column.name);
    for (const values of parseTuples(statement[2])) {
      if (values.length !== names.length) continue;
      const converted = values.map((value, index) => {
        const actualType = actualTypes.get(names[index]);
        if (value !== null && actualType?.includes('timestamp') && typeof value === 'number') return new Date(value * 1000);
        if (value !== null && actualType === 'boolean') return Boolean(value);
        return value;
      });
      const placeholders = converted.map((_, index) => `$${index + 1}`).join(',');
      await tenant.query(`INSERT INTO public."${table}" (${names.map((name) => `"${name}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, converted);
      if (samples.length < 3) samples.push(Object.fromEntries(names.map((name, index) => [name, converted[index]])));
      count++;
    }
  }
  await core.query(`INSERT INTO public.platform_table_samples(platform_id,table_name,sample_rows,source_file) VALUES($1,$2,$3::jsonb,$4)
    ON CONFLICT(platform_id,table_name) DO UPDATE SET sample_rows=excluded.sample_rows,source_file=excluded.source_file,refreshed_at=now()`,
    [platformId, table, JSON.stringify(samples), 'public/YII/yang.sql']);
  imported[table] = count;
}
await tenant.end(); await core.end();
process.stdout.write(JSON.stringify({ platformSlug, database, imported }, null, 2));
