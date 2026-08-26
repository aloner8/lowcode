import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only compatibility route for legacy YII uploads.
 *
 * Published site pages reference these paths, so it stays anonymous, but it is
 * strictly read-only and shared. New uploads are tenant-scoped and served by
 * `/api/file-manager/raw` instead.
 */
const roots = [
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'backend', 'web', 'uploads'),
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'frontend', 'web', 'uploads'),
];

const types: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.zip': 'application/zip',
};

/** SVG can carry script, so it is never rendered inline on this origin. */
const INLINE_SAFE = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf',
  'video/mp4', 'audio/mpeg',
]);

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path || [];
  if (segments.some((segment) => segment === '..' || segment.includes('\0'))) {
    return new NextResponse('Invalid path', { status: 400 });
  }

  for (const root of roots) {
    const target = path.resolve(root, ...segments);
    // Reject anything that resolves outside the legacy root.
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) continue;

    try {
      const info = await stat(target);
      if (!info.isFile()) continue;

      const type = types[path.extname(target).toLowerCase()] || 'application/octet-stream';
      const body = await readFile(target);

      return new NextResponse(new Uint8Array(body), {
        headers: {
          'Content-Type': type,
          'Content-Length': String(info.size),
          'Content-Disposition': `${INLINE_SAFE.has(type) ? 'inline' : 'attachment'}; filename="${encodeURIComponent(path.basename(target))}"`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      // Try the other legacy uploads root.
    }
  }
  return new NextResponse('Not found', { status: 404 });
}
