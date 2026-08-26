import { Pool } from 'pg';

declare global {
  var __lowcodeCoreDbPool: Pool | undefined;
}

function getConnectionString(): string {
  const connectionString = process.env.CORE_DATABASE_URL;

  if (!connectionString) {
    throw new Error('CORE_DATABASE_URL is not configured');
  }

  return connectionString;
}

export function getCoreDb(): Pool {
  if (!global.__lowcodeCoreDbPool) {
    global.__lowcodeCoreDbPool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return global.__lowcodeCoreDbPool;
}
