import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../docker/postgres/migrations/030_create_customer_quota_operations.sql', import.meta.url),
  'utf8',
);

describe('P6 atomic Customer quota migration', () => {
  it('serializes quota edits and runtime reservations on the Customer row', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.set_customer_quotas');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.register_app_runtime_operation');
    expect(migration.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('counts desired and observed runtime reservations before allowing Start', () => {
    expect(migration).toContain("app.desired_state = 'RUNNING'");
    expect(migration).toContain("app.observed_state IN ('STARTING', 'RUNNING', 'STOPPING')");
    expect(migration).toContain('Customer running App quota exceeded');
  });

  it('rejects quota reductions below current usage', () => {
    expect(migration).toContain('Template quota is below current usage');
    expect(migration).toContain('App quota is below current usage');
    expect(migration).toContain('Running App quota is below current usage');
  });

  it('is additive and never deletes an App or Customer', () => {
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
  });
});
