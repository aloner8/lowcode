import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), resolveTxt: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup, resolveTxt: mocks.resolveTxt }));

import { checkDomainDns } from '@/lib/runtime/domainReadiness';

describe('P6 domain DNS ownership check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires the matching TXT proof before accepting A/AAAA records', async () => {
    mocks.resolveTxt.mockResolvedValue([['matchanu-site-verification=wrong-token']]);
    await expect(checkDomainDns('www.example.test', 'right-token')).resolves.toEqual(
      expect.objectContaining({ ready: false, ownershipVerified: false }),
    );
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('returns ready only after ownership and address resolution both pass', async () => {
    mocks.resolveTxt.mockResolvedValue([['matchanu-site-verification=right-token']]);
    mocks.lookup.mockResolvedValue([{ address: '192.0.2.10', family: 4 }]);
    await expect(checkDomainDns('www.example.test', 'right-token')).resolves.toEqual({
      ready: true, ownershipVerified: true, addresses: ['192.0.2.10'], error: null,
    });
    expect(mocks.resolveTxt).toHaveBeenCalledWith('_matchanu-verification.www.example.test');
  });
});
