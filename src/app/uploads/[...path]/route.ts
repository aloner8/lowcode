import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const roots = [path.join(process.cwd(), 'public', 'YII', 'yang-main', 'backend', 'web', 'uploads'), path.join(process.cwd(), 'public', 'YII', 'yang-main', 'frontend', 'web', 'uploads')];
const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.zip': 'application/zip' };

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path || [];
  if (segments.some((segment) => segment === '..')) return new NextResponse('Invalid path', { status: 400 });
  for (const root of roots) {
    const target = path.join(root, ...segments);
    try {
      const info = await stat(target);
      if (!info.isFile()) continue;
      const body = await readFile(target);
      return new NextResponse(body, { headers: { 'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': String(info.size), 'Cache-Control': 'public, max-age=3600' } });
    } catch { /* try the other YII uploads root */ }
  }
  return new NextResponse('Not found', { status: 404 });
}
