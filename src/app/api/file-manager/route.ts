import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uploadRoots = [
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'backend', 'web', 'uploads'),
  path.join(process.cwd(), 'public', 'YII', 'yang-main', 'frontend', 'web', 'uploads'),
];
const virtualRoot = '/uploads';

const cleanRelative = (value = '') => {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\/?/, '');
  if (normalized.split('/').some((part) => part === '..')) throw new Error('Invalid uploads path');
  return normalized;
};
const virtualPath = (relative: string) => relative ? `${virtualRoot}/${relative.replace(/\\/g, '/')}` : virtualRoot;
const publicUrl = (relative: string) => `/uploads/${relative.split('/').map(encodeURIComponent).join('/')}`;
const resolveExisting = async (relative: string) => {
  const clean = cleanRelative(relative);
  for (const root of uploadRoots) {
    const candidate = path.join(root, clean);
    try { await stat(candidate); return { absolute: candidate, root, relative: clean }; } catch { /* continue */ }
  }
  return { absolute: path.join(uploadRoots[0], clean), root: uploadRoots[0], relative: clean };
};
const mimeType = (name: string) => {
  const ext = path.extname(name).toLowerCase();
  return ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.zip': 'application/zip' } as Record<string, string>)[ext] || 'application/octet-stream';
};

async function directoryTree(root: string, relative = '', depth = 0): Promise<Array<Record<string, unknown>>> {
  if (depth > 8) return [];
  const absolute = path.join(root, relative);
  let entries: Dirent<string>[] = [];
  try { entries = await readdir(absolute, { withFileTypes: true }); } catch { return []; }
  return Promise.all(entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).map(async (entry) => {
    const childRelative = path.posix.join(relative.replace(/\\/g, '/'), entry.name);
    return { id: `${root.includes(`${path.sep}frontend${path.sep}`) ? 'front' : 'back'}:${childRelative}`, name: entry.name, path: virtualPath(childRelative), parentPath: virtualPath(relative), children: await directoryTree(root, childRelative, depth + 1) };
  }));
}

export async function GET(request: NextRequest) {
  try {
    const requested = cleanRelative(request.nextUrl.searchParams.get('path') || '');
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('cursor') || 0));
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 40)));
    const trees = await Promise.all(uploadRoots.map((root) => directoryTree(root)));
    const files: Array<Record<string, unknown>> = [];
    for (const root of uploadRoots) {
      try {
        const entries = await readdir(path.join(root, requested), { withFileTypes: true });
        for (const entry of entries.filter((item) => item.isFile())) {
          const relative = path.posix.join(requested, entry.name);
          const info = await stat(path.join(root, requested, entry.name));
          files.push({ id: `${root}:${relative}`, name: entry.name, path: virtualPath(relative), url: publicUrl(relative), thumbnailUrl: mimeType(entry.name).startsWith('image/') ? publicUrl(relative) : undefined, mimeType: mimeType(entry.name), size: info.size, updatedAt: info.mtime.toISOString() });
        }
      } catch { /* directory may exist only in the other YII web root */ }
    }
    files.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const page = files.slice(offset, offset + limit);
    return NextResponse.json({ rootPath: virtualRoot, currentPath: virtualPath(requested), directories: trees.flat(), files: page, hasMore: offset + limit < files.length, nextCursor: offset + limit < files.length ? String(offset + limit) : null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to list uploads' }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const data = await request.formData();
      const relative = cleanRelative(String(data.get('path') || ''));
      const destination = path.join(uploadRoots[0], relative);
      await mkdir(destination, { recursive: true });
      const assets = [];
      for (const item of data.getAll('files')) if (item instanceof File) {
        const safeName = path.basename(item.name).replace(/[^\p{L}\p{N}._ -]/gu, '_');
        const target = path.join(destination, safeName);
        await writeFile(target, Buffer.from(await item.arrayBuffer()));
        const child = path.posix.join(relative, safeName);
        assets.push({ id: `upload:${child}`, name: safeName, path: virtualPath(child), url: publicUrl(child), mimeType: item.type || mimeType(safeName), size: item.size, updatedAt: new Date().toISOString() });
      }
      return NextResponse.json({ files: assets });
    }
    const body = await request.json() as { action?: string; path?: string; name?: string };
    if (body.action !== 'create-directory' || !body.name?.trim()) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    const parent = cleanRelative(body.path || '');
    const name = path.basename(body.name.trim());
    const relative = path.posix.join(parent, name);
    await mkdir(path.join(uploadRoots[0], relative), { recursive: false });
    return NextResponse.json({ directory: { id: `dir:${relative}`, name, path: virtualPath(relative), parentPath: virtualPath(parent), children: [] } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update uploads' }, { status: 400 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { path?: string; name?: string };
    const source = await resolveExisting(body.path || '');
    const name = path.basename(body.name?.trim() || '');
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    await rename(source.absolute, path.join(path.dirname(source.absolute), name));
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to rename upload' }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const target = await resolveExisting(request.nextUrl.searchParams.get('path') || '');
    if (!target.relative) return NextResponse.json({ error: 'Uploads root cannot be deleted' }, { status: 400 });
    await rm(target.absolute, { recursive: true, force: false });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete upload' }, { status: 400 }); }
}
