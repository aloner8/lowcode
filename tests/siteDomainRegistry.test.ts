import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db/coreDb', () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { addSiteDomain, buildDomainMap, findSiteByHost } from '@/lib/runtime/siteRegistry';
import { generateNginxConfig } from '@/lib/engine/NginxConfigGenerator';
import type { SiteRecord } from '@/lib/runtime/siteRegistry';

const site = (domains: string[]): SiteRecord => ({
  appId: 'app-a', appSlug: 'agency', appName: 'Agency', port: 33001,
  subdomain: 'pending.example.test', tenantDbName: 'app_db_agency', isActive: true,
  themeConfig: {} as SiteRecord['themeConfig'], tenantOverrides: {}, seoSettings: {},
  platformId: null, platformSlug: null, domains,
});

describe('P6 collision-safe domain registry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a pending reservation without an ownership-transferring upsert', async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{
      id: 'domain-a', domain: 'www.example.test', is_primary: false, force_https: false,
      is_active: true, readiness_status: 'PENDING_DNS', dns_checked_at: null,
      proxy_checked_at: null, verified_at: null, verification_token: 'verify-token', last_error: null,
    }] });
    await expect(addSiteDomain('app-a', 'www.example.test')).resolves.toEqual(
      expect.objectContaining({ domain: 'www.example.test', readinessStatus: 'PENDING_DNS' }),
    );
    const sql = mocks.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('ON CONFLICT');
    expect(sql).not.toContain('SET app_id');
    expect(mocks.query.mock.calls[0][1][3]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not route the canonical subdomain unless it is in the ready domain array', async () => {
    mocks.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await findSiteByHost('pending.example.test');
    expect(mocks.query.mock.calls[0][0]).not.toContain('LOWER(subdomain)');

    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [site([])] });
    await expect(buildDomainMap()).resolves.toEqual({});
  });

  it('generates proxy blocks only for ready domains', () => {
    expect(generateNginxConfig([site([])])).not.toContain('# Agency (agency)');
    const config = generateNginxConfig([site(['ready.example.test'])]);
    expect(config).toContain('server_name ready.example.test;');
    expect(config).not.toContain('pending.example.test');
  });
});
