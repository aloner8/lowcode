import { NextResponse } from 'next/server';
import { requirePlatformSession } from '@/lib/auth/apiAuth';
import { listPlatformDatabases, PlatformDatabaseError } from '@/lib/db/platformDatabases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requirePlatformSession(id, 'VIEWER');
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ databases: await listPlatformDatabases(id) });
  } catch (error) {
    if (error instanceof PlatformDatabaseError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Unable to list Platform databases', error);
    return NextResponse.json({ error: 'Unable to list Platform databases' }, { status: 500 });
  }
}
