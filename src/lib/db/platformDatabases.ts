import 'server-only';

import type { Pool } from 'pg';
import { getCoreDb } from './coreDb';
import { getTenantDbByName, tenantDatabaseName } from './tenantDb';

export type PlatformDatabase = {
  name: string;
  label: string;
  kind: 'platform' | 'app';
  appId?: string;
};

export class PlatformDatabaseError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'PlatformDatabaseError';
  }
}

export async function listPlatformDatabases(platformId: string): Promise<PlatformDatabase[]> {
  const platform = await getCoreDb().query<{ platform_slug: string; platform_name: string }>(
    'SELECT platform_slug, platform_name FROM public.platforms WHERE id = $1',
    [platformId],
  );
  if (!platform.rowCount) throw new PlatformDatabaseError('Platform not found', 404);

  const apps = await getCoreDb().query<{
    id: string; app_name: string; app_slug: string; tenant_db_name: string;
  }>(
    `SELECT id, app_name, app_slug, tenant_db_name
     FROM public.apps
     WHERE platform_id = $1 AND is_active = TRUE
     ORDER BY app_name`,
    [platformId],
  );

  const master = platform.rows[0];
  const databases: PlatformDatabase[] = [{
    name: tenantDatabaseName(master.platform_slug),
    label: `${master.platform_name} (Platform Master)`,
    kind: 'platform',
  }];
  for (const app of apps.rows) {
    if (databases.some((item) => item.name === app.tenant_db_name)) continue;
    databases.push({ name: app.tenant_db_name, label: `${app.app_name} (${app.app_slug})`, kind: 'app', appId: app.id });
  }
  return databases;
}

export async function resolvePlatformDatabase(
  platformId: string,
  requestedDatabase?: string | null,
): Promise<{ pool: Pool; database: string; descriptor: PlatformDatabase }> {
  const databases = await listPlatformDatabases(platformId);
  const descriptor = requestedDatabase
    ? databases.find((item) => item.name === requestedDatabase)
    : databases[0];
  if (!descriptor) throw new PlatformDatabaseError('Database does not belong to this Platform', 403);
  return { pool: await getTenantDbByName(descriptor.name), database: descriptor.name, descriptor };
}
