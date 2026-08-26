import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/apiAuth';
import { buildDomainMap, listSites } from '@/lib/runtime/siteRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Site registry consumed by `scripts/run-sites.mjs`, the Nginx generator and
 * the admin UI.
 */
export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';

  try {
    const [sites, domainMap] = await Promise.all([listSites(includeInactive), buildDomainMap()]);
    return NextResponse.json({ sites, domainMap });
  } catch (error) {
    console.error('Unable to load site registry', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่าน Site Registry ได้' }, { status: 500 });
  }
}
