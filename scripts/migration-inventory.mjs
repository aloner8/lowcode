#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const { Client } = pg;

export const INVENTORY_SOURCES = [
  { key: 'accounts', mappingDependencies: ['customer_memberships'], table: 'platform_users', fingerprint: "jsonb_build_array(id, username, email, global_role, is_active, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.customer_memberships m WHERE m.user_id=s.id))::text AS mapped_count FROM public.platform_users s" },
  { key: 'platforms', mappingDependencies: ['templates'], table: 'platforms', fingerprint: "jsonb_build_array(id, platform_slug, is_published, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.templates t WHERE t.legacy_platform_id=s.id))::text AS mapped_count FROM public.platforms s" },
  { key: 'apps', table: 'apps', fingerprint: "jsonb_build_array(id, app_slug, platform_id, template_id, template_revision_id, tenant_db_name, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE template_id IS NOT NULL AND template_revision_id IS NOT NULL)::text AS mapped_count FROM public.apps" },
  { key: 'pages', mappingDependencies: ['templates', 'template_objects'], table: 'platform_pages', fingerprint: "jsonb_build_array(id, platform_id, page_slug, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.templates t JOIN public.template_objects o ON o.template_id=t.id AND o.object_type='PAGE' WHERE t.legacy_platform_id=s.platform_id AND o.object_key=s.id::text))::text AS mapped_count FROM public.platform_pages s" },
  { key: 'components', mappingDependencies: ['templates', 'template_objects'], table: 'platform_components', fingerprint: "jsonb_build_array(id, platform_id, component_key, component_type, version, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.templates t JOIN public.template_objects o ON o.template_id=t.id AND o.object_type='COMPONENT' WHERE t.legacy_platform_id=s.platform_id AND o.object_key=s.component_key))::text AS mapped_count FROM public.platform_components s" },
  { key: 'collections', mappingDependencies: ['templates', 'template_objects'], table: 'collection_sets', fingerprint: "jsonb_build_array(id, platform_id, collection_key, version, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.templates t JOIN public.template_objects o ON o.template_id=t.id AND o.object_type='COLLECTION' WHERE t.legacy_platform_id=s.platform_id AND o.object_key=s.collection_key))::text AS mapped_count FROM public.collection_sets s" },
  { key: 'domains', table: 'app_domains', fingerprint: "jsonb_build_array(id, app_id, domain, is_primary, is_active, readiness_status, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE readiness_status='READY')::text AS mapped_count FROM public.app_domains" },
  { key: 'bindings', table: 'app_service_bindings', fingerprint: "jsonb_build_array(id, platform_id, app_id, binding_key, service_key, service_version, status, revision, updated_at)", mapping: "SELECT COUNT(*) FILTER (WHERE status IN ('valid','published'))::text AS mapped_count FROM public.app_service_bindings" },
];

export const REFERENCE_CHECKS = [
  { key: 'apps_without_source_or_template', dependencies: ['apps'], sql: "SELECT COUNT(*)::text AS violation_count FROM public.apps WHERE platform_id IS NULL AND template_id IS NULL" },
  { key: 'page_component_missing_page', dependencies: ['platform_pages_components', 'platform_pages'], sql: "SELECT COUNT(*)::text AS violation_count FROM public.platform_pages_components i LEFT JOIN public.platform_pages p ON p.id=i.platform_page_id WHERE p.id IS NULL" },
  { key: 'page_component_missing_component', dependencies: ['platform_pages_components', 'platform_components'], sql: "SELECT COUNT(*)::text AS violation_count FROM public.platform_pages_components i LEFT JOIN public.platform_components c ON c.id=i.platform_component_id WHERE c.id IS NULL" },
  { key: 'domain_missing_app', dependencies: ['app_domains', 'apps'], sql: "SELECT COUNT(*)::text AS violation_count FROM public.app_domains d LEFT JOIN public.apps a ON a.id=d.app_id WHERE a.id IS NULL" },
  { key: 'binding_missing_scope', dependencies: ['app_service_bindings', 'platforms', 'apps'], sql: "SELECT COUNT(*)::text AS violation_count FROM public.app_service_bindings b LEFT JOIN public.platforms p ON p.id=b.platform_id LEFT JOIN public.apps a ON a.id=b.app_id WHERE p.id IS NULL OR (b.app_id IS NOT NULL AND a.id IS NULL)" },
];

const readSource = async (client, source, missingTables) => {
  if ((await missingTables([source.table])).length) return { key: source.key, table: source.table, status: 'MISSING', count: null, mapped: null, unresolved: null, checksum: null };
  const count = await client.query(`SELECT COUNT(*)::text AS row_count,
    md5(COALESCE(string_agg(md5((${source.fingerprint})::text), '' ORDER BY id::text), '')) AS checksum
    FROM public.${source.table}`);
  const total = Number(count.rows[0].row_count);
  const missingDependencies = await missingTables(source.mappingDependencies ?? []);
  if (missingDependencies.length) return { key: source.key, table: source.table, status: 'AVAILABLE', count: total, mapped: null, unresolved: null, checksum: count.rows[0].checksum, mappingStatus: 'UNAVAILABLE', missingDependencies };
  const mapping = await client.query(source.mapping);
  const mapped = Number(mapping.rows[0].mapped_count);
  return { key: source.key, table: source.table, status: 'AVAILABLE', count: total, mapped, unresolved: total - mapped, checksum: count.rows[0].checksum };
};

export async function createMigrationInventory(client, now = new Date()) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const metadata = await client.query('SELECT current_database() AS database_name, current_setting(\'server_version\') AS server_version');
    const presence = new Map();
    const missingTables = async (tables) => {
      for (const table of tables) {
        if (!presence.has(table)) {
          const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${table}`]);
          presence.set(table, result.rows[0]?.present === true);
        }
      }
      return tables.filter((table) => !presence.get(table));
    };
    const sources = [];
    for (const source of INVENTORY_SOURCES) sources.push(await readSource(client, source, missingTables));
    const references = [];
    for (const check of REFERENCE_CHECKS) {
      const missingDependencies = await missingTables(check.dependencies);
      if (missingDependencies.length) {
        references.push({ key: check.key, status: 'UNAVAILABLE', violations: null, missingDependencies });
        continue;
      }
      const result = await client.query(check.sql);
      references.push({ key: check.key, violations: Number(result.rows[0].violation_count) });
    }
    const missingApps = (await missingTables(['apps'])).length > 0;
    const tenants = missingApps ? { rowCount: 0, rows: [] } : await client.query(`SELECT id AS app_id, app_slug, tenant_db_name
      FROM public.apps ORDER BY app_slug`);
    await client.query('COMMIT');
    const unresolved = sources.some((source) => source.unresolved === null) ? null : sources.reduce((total, source) => total + (source.unresolved ?? 0), 0);
    const violations = references.some((reference) => reference.violations === null) ? null : references.reduce((total, reference) => total + reference.violations, 0);
    return {
      schemaVersion: 'p7-migration-inventory.v1',
      mode: 'dry-run',
      readOnly: true,
      generatedAt: now.toISOString(),
      database: metadata.rows[0],
      sources,
      references,
      assets: {
        status: tenants.rowCount ? 'PER_TENANT_SCAN_REQUIRED' : 'UNAVAILABLE',
        ...(missingApps ? { missingDependencies: ['apps'] } : {}),
        reason: 'Tenant assets live inside each App database and writable storage root; this Core DB dry-run never opens them.',
        tenantDatabases: tenants.rows,
      },
      // Core metadata alone cannot prove asset preservation or restore readiness.
      summary: { sourceRows: sources.reduce((total, source) => total + (source.count ?? 0), 0), unresolvedMappings: unresolved, referenceViolations: violations, readyForApply: false },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const connectionString = process.env.CORE_DATABASE_URL;
  if (!connectionString) throw new Error('CORE_DATABASE_URL must be provided through the process environment');
  const client = new Client({ connectionString, application_name: 'lowcode-p7-inventory' });
  await client.connect();
  try {
    process.stdout.write(`${JSON.stringify(await createMigrationInventory(client), null, 2)}\n`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[migration-inventory] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
