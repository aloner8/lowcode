import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/apiAuth';
import manifest from '@/generated/build-manifest.json';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ data: manifest }, { headers: { 'Cache-Control': 'no-store' } });
}
