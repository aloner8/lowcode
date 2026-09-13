import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), requireApiSession: vi.fn(), requirePlatformAccess: vi.fn(), requireSiteAccess: vi.fn(),
  addSiteDomain: vi.fn(), listAppDomains: vi.fn(), removeSiteDomain: vi.fn(),
  checkDomainDns: vi.fn(), audit: vi.fn(),
}));
vi.mock('@/lib/db/coreDb', () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock('@/lib/auth/apiAuth', () => ({
  requireApiSession: mocks.requireApiSession,
  requirePlatformAccess: mocks.requirePlatformAccess,
  requireSiteAccess: mocks.requireSiteAccess,
}));
vi.mock('@/lib/runtime/siteRegistry', () => ({
  addSiteDomain: mocks.addSiteDomain,
  listAppDomains: mocks.listAppDomains,
  removeSiteDomain: mocks.removeSiteDomain,
}));
vi.mock('@/lib/runtime/domainReadiness', () => ({ checkDomainDns: mocks.checkDomainDns }));
vi.mock('@/lib/engine/AuditLogService', () => ({ recordPlatformAudit: mocks.audit }));

import { PATCH, POST } from '@/app/api/apps/[id]/domains/route';

const context = { params: Promise.resolve({ id: 'app-a' }) };
const jsonRequest = (body: unknown) => new Request('http://localhost/api/apps/app-a/domains', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('P6 App domain readiness API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue({ actor: 'god', sub: 'god-a', role: 'GOD' });
    mocks.requirePlatformAccess.mockResolvedValue(null);
    mocks.requireSiteAccess.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{ platform_id: null, app_slug: 'agency' }] });
    mocks.audit.mockResolvedValue(true);
    mocks.listAppDomains.mockResolvedValue([]);
  });

  it('returns a pending reservation rather than advertising a live site', async () => {
    mocks.addSiteDomain.mockResolvedValue({ id: 'domain-a', domain: 'www.example.test', readinessStatus: 'PENDING_DNS' });
    const response = await POST(jsonRequest({ domain: 'www.example.test' }), context);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ domain: expect.objectContaining({ readinessStatus: 'PENDING_DNS' }) });
  });

  it('reports ownership collisions without moving the domain', async () => {
    mocks.addSiteDomain.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }));
    expect((await POST(jsonRequest({ domain: 'www.example.test' }), context)).status).toBe(409);
  });

  it('advances a successful DNS check only to pending proxy', async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ platform_id: null, app_slug: 'agency' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ domain: 'www.example.test', readiness_status: 'PENDING_DNS', verification_token: 'verify-token' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    mocks.checkDomainDns.mockResolvedValue({ ready: true, ownershipVerified: true, addresses: ['192.0.2.10'], error: null });
    const response = await PATCH(jsonRequest({ domainId: 'domain-a', action: 'VERIFY_DNS' }), context);
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[2][1]).toEqual(['domain-a', 'app-a', 'PENDING_PROXY', null]);
    expect(mocks.checkDomainDns).toHaveBeenCalledWith('www.example.test', 'verify-token');
  });

  it('requires DNS readiness before proxy confirmation', async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ platform_id: null, app_slug: 'agency' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ domain: 'www.example.test', readiness_status: 'PENDING_DNS', verification_token: 'verify-token' }] });
    const response = await PATCH(jsonRequest({ domainId: 'domain-a', action: 'CONFIRM_PROXY' }), context);
    expect(response.status).toBe(409);
  });
});
