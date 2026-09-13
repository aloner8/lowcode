import 'server-only';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveTenantStorage, resolveWritePath, cleanRelative, virtualPath } from '@/lib/storage/tenantStorage';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

export interface ServiceUpload { name: string; type: string; bytes: Buffer }
const BLOCKED = new Set(['.php', '.phtml', '.js', '.mjs', '.cjs', '.jsp', '.asp', '.aspx', '.sh', '.exe', '.bat', '.cmd', '.py']);
const storageFor = (ctx: ServiceExecutionContext) => resolveTenantStorage(ctx.scope.appId ? { appId: ctx.scope.appId } : { platformId: ctx.scope.platformId });
const rootFor = (binding: StudioServiceDefinition) => cleanRelative(String(binding.config.rootNamespace || 'shared'));
const detectedMime = (bytes: Buffer): string | null => {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
};

export async function executeStorageObjectService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  const storage = await storageFor(ctx); const root = rootFor(binding);
  if (operation === 'upload') {
    const files = Array.isArray(input.files) ? input.files as ServiceUpload[] : [];
    const maxFiles = Number(binding.config.maxFilesPerRequest || 5); const maxBytes = Number(binding.config.maxFileBytes || 10485760);
    if (!files.length || files.length > maxFiles) throw new ServiceError('SERVICE_INPUT_INVALID', `Upload requires 1-${maxFiles} files`, 400);
    const allowed = new Set((binding.config.allowedMimeTypes || []).map(String));
    const relativeDirectory = cleanRelative(path.posix.join(root, String(input.path || '')));
    const directory = resolveWritePath(storage, relativeDirectory); await mkdir(directory, { recursive: true });
    const results = [];
    for (const file of files) {
      const name = path.basename(file.name).replace(/[^\p{L}\p{N}._ -]/gu, '_');
      const sniffed = detectedMime(file.bytes); const claimed = file.type || 'application/octet-stream';
      if (!name || BLOCKED.has(path.extname(name).toLowerCase()) || !allowed.has(claimed) || (sniffed && sniffed !== claimed) || file.bytes.length > maxBytes) throw new ServiceError('SERVICE_INPUT_INVALID', `File '${name || 'unknown'}' is not allowed`, file.bytes.length > maxBytes ? 413 : 415);
      const checksum = createHash('sha256').update(file.bytes).digest('hex'); const storedName = `${checksum.slice(0, 12)}-${name}`;
      await writeFile(path.join(/* turbopackIgnore: true */ directory, storedName), file.bytes, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
      const relative = path.posix.join(relativeDirectory, storedName);
      results.push({ assetId: relative, name, mimeType: file.type, size: file.bytes.length, checksum, url: binding.config.visibility === 'public' ? storage.publicUrl(relative) : undefined });
    }
    return { files: results };
  }
  if (operation === 'list') {
    const relative = cleanRelative(path.posix.join(root, String(input.path || ''))); const directory = resolveWritePath(storage, relative);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => { const info = await stat(path.join(directory, entry.name)); return { assetId: path.posix.join(relative, entry.name), name: entry.name, size: info.size, updatedAt: info.mtime.toISOString() }; }));
    return { rootPath: virtualPath(root), files };
  }
  const assetId = cleanRelative(String(input.assetId || ''));
  if (!(assetId === root || assetId.startsWith(`${root}/`))) throw new ServiceError('PERMISSION_DENIED', 'Asset is outside this binding namespace', 403);
  const target = resolveWritePath(storage, assetId);
  if (operation === 'getMetadata') { const info = await stat(target).catch(() => null); if (!info?.isFile()) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Asset not found', 404); return { asset: { assetId, size: info.size, updatedAt: info.mtime.toISOString() } }; }
  if (operation === 'delete') { await rm(target, { force: true }); return { deleted: true }; }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported storage operation '${operation}'`, 405);
}
