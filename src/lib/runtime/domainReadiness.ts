import 'server-only';
import { lookup, resolveTxt } from 'node:dns/promises';

export interface DnsReadinessResult {
  ready: boolean;
  addresses: string[];
  ownershipVerified: boolean;
  error: string | null;
}

/** DNS-only probe. It never connects to the resolved host, avoiding SSRF. */
export async function checkDomainDns(domain: string, verificationToken: string): Promise<DnsReadinessResult> {
  try {
    const txtRecords = await resolveTxt(`_matchanu-verification.${domain}`);
    const expected = `matchanu-site-verification=${verificationToken}`;
    if (!txtRecords.some((parts) => parts.join('') === expected)) {
      return { ready: false, ownershipVerified: false, addresses: [], error: 'ไม่พบ TXT สำหรับยืนยันเจ้าของโดเมน' };
    }
    const records = await lookup(domain, { all: true, verbatim: true });
    const addresses = [...new Set(records.map((record) => record.address))];
    return addresses.length
      ? { ready: true, ownershipVerified: true, addresses, error: null }
      : { ready: false, ownershipVerified: true, addresses: [], error: 'DNS ไม่พบ A/AAAA record' };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'DNS_LOOKUP_FAILED';
    return { ready: false, ownershipVerified: false, addresses: [], error: `DNS lookup ไม่สำเร็จ (${code})` };
  }
}
