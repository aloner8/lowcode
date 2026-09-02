import { NextResponse } from 'next/server';
import { listServiceDefinitions } from '@/lib/services/catalog';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ services: listServiceDefinitions() }); }
