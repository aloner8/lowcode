import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { generateSiteMap } from '@/lib/engine/generateSiteMap';
import type { AppRoute } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getCoreDb().query<{ studio_routes: AppRoute[] }>('SELECT studio_routes FROM public.platforms WHERE id=$1', [id]);
  if (!result.rowCount) return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
  return NextResponse.json({ siteMap: generateSiteMap(Array.isArray(result.rows[0].studio_routes) ? result.rows[0].studio_routes : []) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { routes?: AppRoute[] };
  if (!Array.isArray(body.routes)) return NextResponse.json({ error: 'routes must be an array' }, { status: 400 });
  return NextResponse.json({ siteMap: generateSiteMap(body.routes.map((route) => ({ ...route, platformId: id }))) });
}
