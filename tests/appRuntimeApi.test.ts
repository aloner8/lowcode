import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireApiSession: vi.fn(), requireSiteAccess: vi.fn(), load: vi.fn(), register: vi.fn(), audit: vi.fn(),
}));
vi.mock('@/lib/auth/apiAuth', () => ({
  requireApiSession: mocks.requireApiSession, requireSiteAccess: mocks.requireSiteAccess,
}));
vi.mock('@/lib/runtime/appRuntimeState', () => ({
  loadAppRuntimeState: mocks.load, registerAppRuntimeOperation: mocks.register,
}));
vi.mock('@/lib/engine/AuditLogService', () => ({ recordPlatformAudit: mocks.audit }));

import { GET, POST } from '@/app/api/apps/[id]/runtime-state/route';

const context = { params: Promise.resolve({ id: 'app-a' }) };
const state = { appId: 'app-a', desiredState: 'RUNNING', observedState: 'STARTING', metrics: null };

describe('P6 App runtime API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiSession.mockResolvedValue({ sub: 'user-a', actor: 'owner', role: 'TENANT_USER' });
    mocks.requireSiteAccess.mockResolvedValue(null);
    mocks.load.mockResolvedValue(state);
    mocks.register.mockResolvedValue({ operationId: 'operation-a', reused: false });
    mocks.audit.mockResolvedValue(true);
  });

  it('registers Start with App ADMIN access and returns accepted state', async () => {
    const response = await POST(new Request('http://localhost/api/apps/app-a/runtime-state', {
      method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'start-a' },
      body: JSON.stringify({ desiredState: 'RUNNING' }),
    }), context);
    expect(response.status).toBe(202);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(expect.anything(), 'app-a', 'ADMIN');
    expect(mocks.register).toHaveBeenCalledWith({ actorId: 'user-a', appId: 'app-a', desiredState: 'RUNNING', operationKey: 'start-a' });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'START_APP' }));
  });

  it('returns persisted state to App viewers', async () => {
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(mocks.requireSiteAccess).toHaveBeenCalledWith(expect.anything(), 'app-a', 'VIEWER');
  });

  it('reports concurrent running quota conflicts', async () => {
    mocks.register.mockRejectedValue(Object.assign(new Error('Customer running App quota exceeded'), { code: 'P0001' }));
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'start-b' },
      body: JSON.stringify({ desiredState: 'RUNNING' }),
    }), context);
    expect(response.status).toBe(409);
  });
});
