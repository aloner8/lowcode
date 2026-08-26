import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { requirePlatformSession, requireSiteSession } from '@/lib/auth/apiAuth';
import { cleanRelative, resolveTenantStorage, StorageError } from '@/lib/storage/tenantStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

const mimeType = (name: string) => {
  const ext = path.extname(name).toLowerCase();
  return ({
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  } as Record<string, string>)[ext] || 'application/octet-stream';
};

/**
 * Serves one tenant file.
 *
 * Files live outside `public/`, so they can only be read through this handler,
 * which re-checks that the caller has access to that tenant.
 */
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('appId') ?? '';
  const platformId = request.nextUrl.searchParams.get('platformId') ?? '';
  if (!appId && !platformId) {
    return NextResponse.json({ error: 'ต้องระบุ Site หรือ Platform' }, { status: 400 });
  }

  const session = appId
    ? await requireSiteSession(appId, 'VIEWER')
    : await requirePlatformSession(platformId, 'VIEWER');
  if (session instanceof NextResponse) return session;

  try {
    const storage = await resolveTenantStorage({
      appId: appId || undefined,
      platformId: platformId || undefined,
    });
    const relative = cleanRelative(request.nextUrl.searchParams.get('path') || '');
    if (!relative) return NextResponse.json({ error: 'ต้องระบุไฟล์' }, { status: 400 });

    for (const root of storage.readRoots) {
      const absolute = path.resolve(root, relative);
      if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) continue;
      try {
        await stat(absolute);
        const content = await readFile(absolute);
        const type = mimeType(relative);
        return new NextResponse(new Uint8Array(content), {
          headers: {
            'Content-Type': type,
            'Content-Length': String(content.length),
            'Content-Disposition': `${INLINE_TYPES.has(type) ? 'inline' : 'attachment'}; filename="${encodeURIComponent(path.basename(relative))}"`,
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'Cache-Control': 'private, max-age=300',
          },
        });
      } catch {
        // Try the next root.
      }
    }
    return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[file-manager] unable to read file', error);
    return NextResponse.json({ error: 'ไม่สามารถอ่านไฟล์ได้' }, { status: 500 });
  }
}
