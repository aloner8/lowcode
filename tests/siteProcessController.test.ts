import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(new URL('../scripts/run-sites.mjs', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../docker/postgres/migrations/032_add_app_runtime_observability.sql', import.meta.url), 'utf8');
const resourceMigration = readFileSync(new URL('../docker/postgres/migrations/033_add_app_resource_metrics.sql', import.meta.url), 'utf8');

describe('P6 site process controller', () => {
  it('reconciles real children from durable desired state', () => {
    expect(controller).toContain("site.desired_state !== 'RUNNING'");
    expect(controller).toContain("entry.child.kill('SIGTERM')");
    expect(controller).toContain('startSite(site, domainMap)');
  });

  it('marks Running only after the child health endpoint passes', () => {
    expect(controller).toContain('/health`');
    expect(controller.indexOf("payload.status === 'healthy'")).toBeLessThan(controller.indexOf("observed_state = 'RUNNING'"));
    expect(controller).toContain("'HEALTHY'");
    expect(controller).toContain('entry?.healthy');
    expect(controller).toContain('if (!update.rowCount) return');
  });

  it('records unavailable metrics as null rather than a healthy zero', () => {
    expect(controller).toContain('runtime_metrics = NULL');
    expect(controller).toContain('Health unavailable:');
    expect(migration).toContain('runtime_metrics JSONB');
    expect(migration).toContain('health_checked_at TIMESTAMPTZ');
  });

  it('samples database and tenant file storage in the background', () => {
    expect(controller).toContain('pg_database_size($1)');
    expect(controller).toContain('directorySize(path.join(TENANT_STORAGE_ROOT');
    expect(controller).toContain('RESOURCE_SAMPLE_INTERVAL_MS');
    expect(resourceMigration).toContain('resource_metrics JSONB');
    expect(resourceMigration).toContain('resource_metrics_at TIMESTAMPTZ');
  });

  it('does not invoke infrastructure service managers', () => {
    expect(controller).not.toMatch(/systemctl|docker\s+compose|nginx/i);
  });
});
