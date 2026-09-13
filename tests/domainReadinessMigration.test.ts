import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../docker/postgres/migrations/031_add_domain_readiness.sql', import.meta.url),
  'utf8',
);

describe('P6 domain readiness migration', () => {
  it('adds explicit DNS, proxy, and ready states', () => {
    expect(migration).toContain("'PENDING_DNS', 'PENDING_PROXY', 'READY'");
    expect(migration).toContain('dns_checked_at');
    expect(migration).toContain('proxy_checked_at');
    expect(migration).toContain('verification_token');
  });

  it('keeps existing live domains ready while new rows default to pending DNS', () => {
    expect(migration).toContain("DEFAULT 'PENDING_DNS'");
    expect(migration).toContain("SET readiness_status = 'READY'");
  });

  it('publishes only explicitly ready domains into the runtime registry', () => {
    expect(migration).toContain("d.readiness_status = 'READY'");
  });

  it('returns a changed primary hostname to pending verification', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sync_primary_app_domain');
    expect(migration).toContain("readiness_status = 'PENDING_DNS'");
    expect(migration).toContain('verification_token = encode(gen_random_bytes(18)');
  });
});
