import { Pool } from 'pg';
import { getCoreDb } from './coreDb';

/**
 * Tenant databases live on the same PostgreSQL server as the core database but
 * are isolated per tenant. Nothing tenant-scoped — business rows, uploaded
 * assets, structure revisions — is ever written to the core database.
 */

const pools = new Map<string, Pool>();

/** Identifiers are validated, never interpolated blindly. */
const SAFE_DB_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export function tenantDatabaseName(platformSlug: string) {
  return `platform_${platformSlug.replace(/-/g, '_')}`;
}

export function assertSafeDatabaseName(database: string): string {
  if (!SAFE_DB_NAME.test(database)) {
    throw new Error(`Unsafe tenant database name: ${database}`);
  }
  return database;
}

function tenantUrl(database: string) {
  const coreUrl = process.env.CORE_DATABASE_URL;
  if (!coreUrl) throw new Error('CORE_DATABASE_URL is not configured');
  const url = new URL(coreUrl);
  url.pathname = `/${assertSafeDatabaseName(database)}`;
  return url.toString();
}

/**
 * Every tenant database gets the same `sys` bootstrap: runtime snapshot,
 * structure revisions, design configs and the tenant-scoped asset store.
 */
const SYS_BOOTSTRAP = `
  CREATE SCHEMA IF NOT EXISTS sys;

  CREATE TABLE IF NOT EXISTS sys.runtime_snapshots (
    platform_id uuid PRIMARY KEY,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    synced_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sys.structure_revisions (
    revision varchar(64) PRIMARY KEY,
    definition jsonb NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sys.design_configs (
    scope varchar(30) NOT NULL,
    config_key varchar(120) NOT NULL,
    config_value jsonb NOT NULL,
    version integer NOT NULL,
    source_path text,
    synced_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, config_key)
  );

  CREATE TABLE IF NOT EXISTS sys.assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name varchar(500) NOT NULL,
    content_type varchar(255) NOT NULL DEFAULT 'application/octet-stream',
    byte_size bigint NOT NULL CHECK (byte_size > 0),
    checksum char(64) NOT NULL UNIQUE,
    content bytea NOT NULL,
    uploaded_by varchar(255) NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_sys_assets_created ON sys.assets (created_at DESC);
`;

async function bootstrapPool(pool: Pool): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(SYS_BOOTSTRAP);
}

export class TenantDatabaseNotProvisionedError extends Error {
  constructor(readonly database: string) {
    super(`Tenant database '${database}' has not been provisioned`);
    this.name = 'TenantDatabaseNotProvisionedError';
  }
}

async function databaseExists(database: string): Promise<boolean> {
  const exists = await getCoreDb().query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [database],
  );
  return Boolean(exists.rows[0]?.exists);
}

function createPool(database: string): Pool {
  return new Pool({
    connectionString: tenantUrl(database),
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/** Opens an existing tenant DB. Ordinary read paths never create databases. */
export async function openTenantDbByName(database: string): Promise<Pool> {
  assertSafeDatabaseName(database);

  const existingPool = pools.get(database);
  if (existingPool) return existingPool;

  if (!(await databaseExists(database))) {
    throw new TenantDatabaseNotProvisionedError(database);
  }

  const pool = createPool(database);
  pools.set(database, pool);
  return pool;
}

/** Explicit provisioning path used only by tracked provision/publish jobs. */
export async function provisionTenantDatabase(
  database: string,
): Promise<{ pool: Pool; created: boolean }> {
  assertSafeDatabaseName(database);
  let created = false;
  if (!(await databaseExists(database))) {
    try {
      // CREATE DATABASE cannot be parameterised; the name is validated above.
      await getCoreDb().query(`CREATE DATABASE "${database}"`);
      created = true;
    } catch (error) {
      if ((error as { code?: string }).code !== '42P04') throw error;
    }
  }

  const pool = pools.get(database) ?? createPool(database);
  await bootstrapPool(pool);
  pools.set(database, pool);
  return { pool, created };
}

/** @deprecated Name retained for callers; now opens only and never provisions. */
export const getTenantDbByName = openTenantDbByName;

/** Resolves the tenant database for a Platform Master and syncs its snapshot. */
export async function getTenantDb(platformId: string) {
  const platform = await getCoreDb().query<{ platform_slug: string }>(
    'SELECT platform_slug FROM public.platforms WHERE id = $1',
    [platformId],
  );
  if (!platform.rowCount) throw new Error('Platform not found');

  const database = tenantDatabaseName(platform.rows[0].platform_slug);
  const pool = await openTenantDbByName(database);

  return { pool, database };
}

/** Explicitly provisions a Platform test DB and syncs its current snapshot. */
export async function provisionPlatformTenantDb(platformId: string) {
  const platform = await getCoreDb().query<{
    platform_slug: string;
    runtime_snapshot: unknown;
  }>(
    'SELECT platform_slug, runtime_snapshot FROM public.platforms WHERE id = $1',
    [platformId],
  );
  if (!platform.rowCount) throw new Error('Platform not found');

  const database = tenantDatabaseName(platform.rows[0].platform_slug);
  const { pool, created } = await provisionTenantDatabase(database);

  if (platform.rows[0].runtime_snapshot) {
    await pool.query(
      `INSERT INTO sys.runtime_snapshots (platform_id, snapshot) VALUES ($1, $2::jsonb)
       ON CONFLICT (platform_id) DO UPDATE SET snapshot = excluded.snapshot, synced_at = now()`,
      [platformId, JSON.stringify(platform.rows[0].runtime_snapshot)],
    );
  }

  return { pool, database, created };
}

/** Resolves the tenant database belonging to one spawned Tenant App. */
export async function getAppTenantDb(appId: string) {
  const app = await getCoreDb().query<{ tenant_db_name: string; app_slug: string }>(
    'SELECT tenant_db_name, app_slug FROM public.apps WHERE id = $1 AND is_active = TRUE',
    [appId],
  );
  if (!app.rowCount) throw new Error('App not found');

  const database = app.rows[0].tenant_db_name;
  const pool = await openTenantDbByName(database);
  return { pool, database, appSlug: app.rows[0].app_slug };
}

/** Explicit App DB provisioning. Registry ownership is resolved before create. */
export async function provisionAppTenantDb(appId: string) {
  const app = await getCoreDb().query<{ tenant_db_name: string; app_slug: string }>(
    'SELECT tenant_db_name, app_slug FROM public.apps WHERE id = $1',
    [appId],
  );
  if (!app.rowCount) throw new Error('App not found');

  const database = app.rows[0].tenant_db_name;
  const { pool, created } = await provisionTenantDatabase(database);
  return { pool, database, appSlug: app.rows[0].app_slug, created };
}

/** Releases one stopped App's pool so hosts do not accumulate pools forever. */
export async function closeTenantDbPool(database: string): Promise<boolean> {
  assertSafeDatabaseName(database);
  const pool = pools.get(database);
  if (!pool) return false;
  pools.delete(database);
  await pool.end();
  return true;
}
