import { Pool } from 'pg';
import { getCoreDb } from './coreDb';

const pools = new Map<string, Pool>();

export function tenantDatabaseName(platformSlug: string) {
  return `platform_${platformSlug.replace(/-/g, '_')}`;
}

function tenantUrl(database: string) {
  const coreUrl = process.env.CORE_DATABASE_URL;
  if (!coreUrl) throw new Error('CORE_DATABASE_URL is not configured');
  const url = new URL(coreUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

export async function getTenantDb(platformId: string) {
  const platform = await getCoreDb().query<{ platform_slug: string; runtime_snapshot: unknown }>(
    'SELECT platform_slug, runtime_snapshot FROM public.platforms WHERE id=$1', [platformId],
  );
  if (!platform.rowCount) throw new Error('Platform not found');
  const database = tenantDatabaseName(platform.rows[0].platform_slug);
  const exists = await getCoreDb().query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname=$1) AS exists', [database]);
  if (!exists.rows[0].exists) await getCoreDb().query(`CREATE DATABASE "${database}"`);

  let pool = pools.get(database);
  if (!pool) {
    pool = new Pool({ connectionString: tenantUrl(database), max: 8, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    pools.set(database, pool);
  }
  await pool.query(`CREATE SCHEMA IF NOT EXISTS sys;
    CREATE TABLE IF NOT EXISTS sys.runtime_snapshots (
      platform_id uuid PRIMARY KEY, snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, synced_at timestamptz NOT NULL DEFAULT now()
    )`);
  if (platform.rows[0].runtime_snapshot) await pool.query(
    `INSERT INTO sys.runtime_snapshots(platform_id,snapshot) VALUES($1,$2::jsonb)
     ON CONFLICT(platform_id) DO UPDATE SET snapshot=excluded.snapshot,synced_at=now()`,
    [platformId, JSON.stringify(platform.rows[0].runtime_snapshot)],
  );
  return { pool, database };
}
