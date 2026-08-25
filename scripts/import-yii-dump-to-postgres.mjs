import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const dumpPath = resolve(process.argv[2] || 'public/YII/yang.sql');
const connectionString = process.env.TENANT_DATABASE_URL;
if (!connectionString) throw new Error('TENANT_DATABASE_URL is required');

const source = await readFile(dumpPath, 'utf8');
const tableBlocks = [...source.matchAll(/CREATE TABLE `([^`]+)`\s*\(([^]*?)\) ENGINE\s*=/g)];
const tables = new Map();
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const pgType = (mysqlType) => {
  const value = mysqlType.toLowerCase();
  if (/\b(bigint|int|tinyint|smallint|mediumint)\b/.test(value)) return 'bigint';
  if (/\b(decimal|double|float|real)\b/.test(value)) return 'numeric';
  if (/\b(datetime|timestamp)\b/.test(value)) return 'timestamp without time zone';
  if (/^date\b/.test(value)) return 'date';
  if (/^time\b/.test(value)) return 'time without time zone';
  if (/\b(blob|binary|varbinary)\b/.test(value)) return 'bytea';
  return 'text';
};

for (const match of tableBlocks) {
  const [, name, block] = match;
  const columns = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('`')).map((line) => {
    const column = line.match(/^`([^`]+)`\s+([^,]+)/);
    if (!column) return null;
    return { name: column[1], type: pgType(column[2]) };
  }).filter(Boolean);
  tables.set(name, { name, columns, rows: [] });
}

const parseValues = (raw) => {
  const values = []; let token = ''; let quoted = false; let escaped = false;
  const push = () => { const value = token.trim(); values.push(quoted ? token : /^NULL$/i.test(value) ? null : value); token = ''; quoted = false; };
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) { token += ({ n: '\n', r: '\r', t: '\t', 0: '\0', Z: '\x1a' })[char] ?? char; escaped = false; continue; }
    if (char === '\\' && quoted) { escaped = true; continue; }
    if (char === "'") {
      if (quoted && raw[index + 1] === "'") { token += "'"; index += 1; continue; }
      quoted = !quoted; continue;
    }
    if (char === ',' && !quoted) { push(); continue; }
    token += char;
  }
  push(); return values;
};

for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^INSERT INTO `([^`]+)` VALUES \((.*)\);$/);
  if (!match || !tables.has(match[1])) continue;
  tables.get(match[1]).rows.push(parseValues(match[2]));
}

const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backupSchema = `pre_yii_${suffix}`;
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE SCHEMA ${quote(backupSchema)}`);
  for (const table of tables.values()) {
    const exists = await client.query('SELECT to_regclass($1) AS name', [`public.${table.name}`]);
    if (exists.rows[0].name) await client.query(`ALTER TABLE public.${quote(table.name)} SET SCHEMA ${quote(backupSchema)}`);
    await client.query(`CREATE TABLE public.${quote(table.name)} (${table.columns.map((column) => `${quote(column.name)} ${column.type}`).join(', ')})`);
    if (table.rows.length) {
      const placeholders = table.columns.map((_, index) => `$${index + 1}`).join(',');
      const statement = `INSERT INTO public.${quote(table.name)} (${table.columns.map((column) => quote(column.name)).join(',')}) VALUES (${placeholders})`;
      for (const row of table.rows) {
        const normalized = table.columns.map((column, index) => {
          const value = row[index] ?? null;
          if (value === null) return null;
          if (column.type === 'bytea') return Buffer.from(String(value), 'utf8');
          if (column.type.startsWith('timestamp') && /^\d+$/.test(String(value))) return new Date(Number(value) * 1000);
          return value;
        });
        await client.query(statement, normalized);
      }
    }
    if (table.columns.some((column) => column.name === 'id')) {
      try { await client.query(`ALTER TABLE public.${quote(table.name)} ADD PRIMARY KEY (${quote('id')})`); } catch { /* preserve imported rows even when legacy ids are not unique */ }
    }
  }
  await client.query(`CREATE TABLE IF NOT EXISTS sys.yii_imports (imported_at timestamptz NOT NULL DEFAULT now(), source_file text NOT NULL, backup_schema text NOT NULL, table_count integer NOT NULL, row_count integer NOT NULL)`);
  const rowCount = [...tables.values()].reduce((total, table) => total + table.rows.length, 0);
  await client.query('INSERT INTO sys.yii_imports(source_file,backup_schema,table_count,row_count) VALUES($1,$2,$3,$4)', [dumpPath, backupSchema, tables.size, rowCount]);
  await client.query('COMMIT');
  console.log(JSON.stringify({ database: new URL(connectionString).pathname.slice(1), backupSchema, tables: tables.size, rows: rowCount }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { await client.end(); }
