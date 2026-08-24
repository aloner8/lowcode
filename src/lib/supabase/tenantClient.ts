import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Connection cache for isolated tenant database instances
const tenantClientsCache: Map<string, SupabaseClient> = new Map();

/**
 * Creates or retrieves a Supabase / Postgres client configured for a specific Tenant DB Name.
 * Shared PostgreSQL server instance with isolated Database Names per tenant.
 */
export function getTenantDbClient(tenantDbName: string): SupabaseClient {
  if (tenantClientsCache.has(tenantDbName)) {
    return tenantClientsCache.get(tenantDbName)!;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  // Instantiate client with tenant db schema/db header
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'public' },
    global: {
      headers: {
        'x-tenant-db': tenantDbName,
      },
    },
  });

  tenantClientsCache.set(tenantDbName, client);
  return client;
}
