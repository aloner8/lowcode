import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!process.env.SITE_SLUG || process.env.SITE_SLUG !== slug) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({
    status: 'healthy',
    appSlug: slug,
    checkedAt: new Date().toISOString(),
    metrics: {
      memoryRssBytes: process.memoryUsage().rss,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
}
