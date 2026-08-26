import { NextResponse } from 'next/server';
import { requireGod } from '@/lib/auth/apiAuth';
import { listSites } from '@/lib/runtime/siteRegistry';
import { generateNginxConfig } from '@/lib/engine/NginxConfigGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Returns an nginx.conf built from the live site registry. */
export async function GET(request: Request) {
  const auth = await requireGod();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;

  try {
    const config = generateNginxConfig(await listSites(), {
      studioUpstream: params.get('studioUpstream') ?? undefined,
      sitesHost: params.get('sitesHost') ?? undefined,
      studioServerNames: params.get('studioNames')?.split(',').filter(Boolean),
    });
    return new NextResponse(config, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="nginx.conf"',
      },
    });
  } catch (error) {
    console.error('Unable to generate nginx config', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง Nginx Config ได้' }, { status: 500 });
  }
}
