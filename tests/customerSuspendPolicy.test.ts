import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ query: vi.fn(), requireGod: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/db/coreDb', () => ({ getCoreDb: () => ({ query: mocks.query }) }));
vi.mock('@/lib/auth/apiAuth', () => ({ requireGod: mocks.requireGod }));
vi.mock('@/lib/engine/AuditLogService', () => ({ recordPlatformAudit: mocks.audit }));

import { findCustomerAccessBlock } from '@/lib/auth/customerAccess';
import { POST as setCustomerStatus } from '@/app/api/admin/customers/[id]/status/route';

describe('P6 Customer Suspend policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audit.mockResolvedValue(true);
    mocks.requireGod.mockResolvedValue({ actor: 'god-admin' });
  });

  it('blocks tenant control-plane access when any Customer membership is suspended', async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 'customer-a', customer_name: 'Agency A', status: 'SUSPENDED' }],
    });
    await expect(findCustomerAccessBlock('user-a', 'TENANT_USER')).resolves.toEqual({
      customerId: 'customer-a', customerName: 'Agency A', status: 'SUSPENDED',
    });
    expect(mocks.query.mock.calls[0][0]).toContain("customer.status IN ('SUSPENDED', 'ARCHIVED')");
  });

  it('never applies Customer suspension to GOD accounts', async () => {
    await expect(findCustomerAccessBlock('god-a', 'GOD')).resolves.toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('suspends only the Customer record and records that Apps remain unchanged', async () => {
    mocks.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 'customer-a', customer_name: 'Agency A', previous_status: 'ACTIVE', status: 'SUSPENDED' }],
    });
    const request = new Request('http://localhost/api/admin/customers/customer-a/status', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'status=SUSPENDED',
    });
    const response = await setCustomerStatus(request, { params: Promise.resolve({ id: 'customer-a' }) });
    expect(response.status).toBe(303);
    const sql = mocks.query.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE public.customers');
    expect(sql).not.toContain('UPDATE public.apps');
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SUSPEND_CUSTOMER',
      entityType: 'CUSTOMER',
      snapshotAfter: { status: 'SUSPENDED', appsChanged: false },
    }));
  });

  it('rejects unsupported status changes before touching data', async () => {
    const request = new Request('http://localhost/api/admin/customers/customer-a/status', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'status=ARCHIVED',
    });
    expect((await setCustomerStatus(request, { params: Promise.resolve({ id: 'customer-a' }) })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('passes through GOD authorization failures', async () => {
    mocks.requireGod.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    const request = new Request('http://localhost/api/admin/customers/customer-a/status', { method: 'POST' });
    expect((await setCustomerStatus(request, { params: Promise.resolve({ id: 'customer-a' }) })).status).toBe(403);
  });
});
