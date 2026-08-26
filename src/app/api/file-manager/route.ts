import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';
import { requirePlatformSession, requireSiteSession } from '@/lib/auth/apiAuth';
import {
  cleanRelative,
  resolveTenantStorage,
  resolveWritePath,
  StorageError,
  VIRTUAL_ROOT,
  virtualPath,
  type TenantStorage,
} from '@/lib/storage/tenantStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * File Manager backing store.
 *
 * Every request is authenticated and scoped to one Site: files are written
 * beneath that tenant's own directory, so one agency can never read, rename or
 * delete another agency's uploads.
 */

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

const BLOCKED_EXTENSIONS = new Set([
  '.php', '.phtml', '.php5', '.js', '.mjs', '.cjs', '.jsp', '.asp', '.aspx',
  '.sh', '.bash', '.exe', '.bat', '.cmd', '.htaccess', '.cgi', '.pl', '.py',
]);

const mimeType = (name: string) => {
  const ext = path.extname(name).toLowerCase();
  return ({
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.zip': 'application/zip',
  } as Record<string, string>)[ext] || 'application/octet-stream';
};

/**
 * Authenticates and resolves the Site for this request.
 * `appId` is required — there is no unscoped shared storage to fall back to.
 */
async function authorize(request: NextRequest, minimumRole: 'STAFF' | 'ADMIN' = 'STAFF') {
  const appId = request.nextUrl.searchParams.get('appId') ?? '';
  const platformId = request.nextUrl.searchParams.get('platformId') ?? '';

  if (!appId && !platformId) {
    return { response: NextResponse.json({ error: 'ต้องระบุ Site (appId) หรือ Platform (platformId)' }, { status: 400 }) };
  }

  const session = appId
    ? await requireSiteSession(appId, minimumRole)
    : await requirePlatformSession(platformId, minimumRole);
  if (session instanceof NextResponse) return { response: session };

  try {
    return { storage: await resolveTenantStorage({ appId: appId || undefined, platformId: platformId || undefined }) };
  } catch (error) {
    if (error instanceof StorageError) {
      return { response: NextResponse.json({ error: error.message }, { status: error.status }) };
    }
    throw error;
  }
}

const failure = (error: unknown) => {
  if (error instanceof StorageError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[file-manager] operation failed', error);
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการกับไฟล์ได้' }, { status: 400 });
};

async function directoryTree(root: string, relative = '', depth = 0): Promise<Array<Record<string, unknown>>> {
  if (depth > 8) return [];
  let entries: Dirent<string>[] = [];
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return [];
  }
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const childRelative = path.posix.join(relative.replace(/\\/g, '/'), entry.name);
        return {
          id: `dir:${childRelative}`,
          name: entry.name,
          path: virtualPath(childRelative),
          parentPath: virtualPath(relative),
          children: await directoryTree(root, childRelative, depth + 1),
        };
      }),
  );
}

async function listFiles(storage: TenantStorage, requested: string) {
  const files: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const root of storage.readRoots) {
    try {
      const entries = await readdir(path.join(root, requested), { withFileTypes: true });
      for (const entry of entries.filter((item) => item.isFile())) {
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);
        const relative = path.posix.join(requested, entry.name);
        const info = await stat(path.join(root, requested, entry.name));
        const type = mimeType(entry.name);
        files.push({
          id: `${relative}`,
          name: entry.name,
          path: virtualPath(relative),
          url: storage.publicUrl(relative),
          thumbnailUrl: type.startsWith('image/') ? storage.publicUrl(relative) : undefined,
          mimeType: type,
          size: info.size,
          updatedAt: info.mtime.toISOString(),
        });
      }
    } catch {
      // Directory may not exist in this root yet.
    }
  }
  return files.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function GET(request: NextRequest) {
  const guard = await authorize(request);
  if (guard.response) return guard.response;
  const storage = guard.storage!;

  try {
    const requested = cleanRelative(request.nextUrl.searchParams.get('path') || '');
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('cursor') || 0));
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 40)));

    const files = await listFiles(storage, requested);
    const page = files.slice(offset, offset + limit);

    return NextResponse.json({
      rootPath: VIRTUAL_ROOT,
      currentPath: virtualPath(requested),
      directories: await directoryTree(storage.writeRoot),
      files: page,
      hasMore: offset + limit < files.length,
      nextCursor: offset + limit < files.length ? String(offset + limit) : null,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const guard = await authorize(request);
  if (guard.response) return guard.response;
  const storage = guard.storage!;

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const data = await request.formData();
      const destination = resolveWritePath(storage, String(data.get('path') || ''));
      await mkdir(destination, { recursive: true });

      const assets = [];
      for (const item of data.getAll('files')) {
        if (!(item instanceof File)) continue;
        if (item.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: `ไฟล์ "${item.name}" ใหญ่เกิน ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB` },
            { status: 413 },
          );
        }
        const safeName = path.basename(item.name).replace(/[^\p{L}\p{N}._ -]/gu, '_');
        // Executable extensions are refused: uploads are served back to visitors.
        if (BLOCKED_EXTENSIONS.has(path.extname(safeName).toLowerCase())) {
          return NextResponse.json({ error: `ชนิดไฟล์ "${safeName}" ไม่ได้รับอนุญาต` }, { status: 415 });
        }

        await writeFile(path.join(destination, safeName), Buffer.from(await item.arrayBuffer()));
        const child = path.posix.join(cleanRelative(String(data.get('path') || '')), safeName);
        assets.push({
          id: child,
          name: safeName,
          path: virtualPath(child),
          url: storage.publicUrl(child),
          mimeType: item.type || mimeType(safeName),
          size: item.size,
          updatedAt: new Date().toISOString(),
        });
      }
      return NextResponse.json({ files: assets });
    }

    const body = (await request.json()) as { action?: string; path?: string; name?: string };
    if (body.action !== 'create-directory' || !body.name?.trim()) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const parent = cleanRelative(body.path || '');
    const name = path.basename(body.name.trim());
    const relative = path.posix.join(parent, name);
    await mkdir(resolveWritePath(storage, relative), { recursive: false });

    return NextResponse.json({
      directory: {
        id: `dir:${relative}`,
        name,
        path: virtualPath(relative),
        parentPath: virtualPath(parent),
        children: [],
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await authorize(request);
  if (guard.response) return guard.response;
  const storage = guard.storage!;

  try {
    const body = (await request.json()) as { path?: string; name?: string };
    const name = path.basename(body.name?.trim() || '');
    if (!name) return NextResponse.json({ error: 'ต้องระบุชื่อใหม่' }, { status: 400 });

    const source = resolveWritePath(storage, body.path || '');
    const target = resolveWritePath(storage, path.posix.join(path.posix.dirname(cleanRelative(body.path || '')), name));
    await rename(source, target);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await authorize(request, 'ADMIN');
  if (guard.response) return guard.response;
  const storage = guard.storage!;

  try {
    const relative = cleanRelative(request.nextUrl.searchParams.get('path') || '');
    if (!relative) return NextResponse.json({ error: 'ลบโฟลเดอร์รากไม่ได้' }, { status: 400 });

    await rm(resolveWritePath(storage, relative), { recursive: true, force: false });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
