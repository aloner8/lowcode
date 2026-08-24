import { NextResponse } from 'next/server';
import { publishTenantStructure } from '@/lib/db/publishTenantStructure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await publishTenantStructure((await context.params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 }); }
}
