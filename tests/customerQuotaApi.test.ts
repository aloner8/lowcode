import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ query: vi.fn(), requireGod: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/db/coreDb', () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock('@/lib/auth/apiAuth', () => ({ requireGod: mocks.requireGod }));
vi.mock('@/lib/engine/AuditLogService', () => ({ recordPlatformAudit: mocks.audit }));

import { POST } from '@/app/api/admin/customers/[id]/quotas/route';

const request = (body: string) => new Request('http://localhost/api/admin/customers/customer-a/quotas', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
});

describe('P6 Customer quota API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireGod.mockResolvedValue({ actor: 'god-admin' });
    mocks.audit.mockResolvedValue(true);
  });

  it('uses the atomic database function and audits the resulting limits', async () => {
    const quotas = { maxTemplates: 12, maxApps: 8, maxRunningApps: 3 };
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{ quotas }] });
    const response = await POST(request('maxTemplates=12&maxApps=8&maxRunningApps=3'), {
      params: Promise.resolve({ id: 'customer-a' }),
    });
    expect(response.status).toBe(303);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('public.set_customer_quotas'),
      ['customer-a', 12, 8, 3],
    );
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE_CUSTOMER_QUOTAS', snapshotAfter: quotas,
    }));
  });

  it('rejects malformed or excessive values before querying', async () => {
    expect((await POST(request('maxTemplates=-1&maxApps=8&maxRunningApps=3'), {
      params: Promise.resolve({ id: 'customer-a' }),
    })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('reports a quota reduction below usage as a conflict', async () => {
    mocks.query.mockRejectedValue(Object.assign(new Error('App quota is below current usage (9)'), { code: 'P0001' }));
    const response = await POST(request('maxTemplates=12&maxApps=8&maxRunningApps=3'), {
      params: Promise.resolve({ id: 'customer-a' }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'App quota is below current usage (9)' });
  });

  it('passes through GOD authorization failures', async () => {
    mocks.requireGod.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    expect((await POST(request(''), { params: Promise.resolve({ id: 'customer-a' }) })).status).toBe(403);
  });
});
