import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let previousCpuUsage = process.cpuUsage();
let previousCpuSample = process.hrtime.bigint();

function sampleCpuPercent() {
  const sampledAt = process.hrtime.bigint();
  const elapsedMicros = Number(sampledAt - previousCpuSample) / 1_000;
  const usage = process.cpuUsage(previousCpuUsage);
  previousCpuUsage = process.cpuUsage();
  previousCpuSample = sampledAt;
  if (elapsedMicros <= 0) return null;
  return Math.round(((usage.user + usage.system) / elapsedMicros) * 10_000) / 100;
}

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
      cpuPercent: sampleCpuPercent(),
      memoryRssBytes: process.memoryUsage().rss,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
}
