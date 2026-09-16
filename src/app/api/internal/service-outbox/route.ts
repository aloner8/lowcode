import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processEmailOutbox } from '@/lib/services/outboxWorker';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const equal = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
export async function POST(request: Request) {
  const configured = process.env.SERVICE_WORKER_SECRET || ''; const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!configured || !equal(configured, supplied)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requestedLimit = Number(new URL(request.url).searchParams.get('limit') || 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
  return NextResponse.json(await processEmailOutbox(limit));
}
