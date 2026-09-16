import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { cleanRelative, resolveTenantStorage, resolveWritePath } from '@/lib/storage/tenantStorage';
import { ServiceError } from './errors';
import type { ServiceExecutionContext } from './runtimeContext';
import type { StudioServiceDefinition } from '@/types';

const storageFor = (ctx: ServiceExecutionContext) => resolveTenantStorage(ctx.scope.appId ? { appId: ctx.scope.appId } : { platformId: ctx.scope.platformId });

export async function executeLocalMediaService(ctx: ServiceExecutionContext, binding: StudioServiceDefinition, operation: string, input: Record<string, any>) {
  if (operation === 'qrCode') {
    const size = Number(input.size || 256);
    const format = input.format === 'svg' ? 'svg' : 'png';
    if (format === 'svg') {
      const svg = await QRCode.toString(String(input.value), { type: 'svg', width: size, margin: 2, errorCorrectionLevel: 'M' });
      return { mimeType: 'image/svg+xml', dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
    }
    const dataUrl = await QRCode.toDataURL(String(input.value), { width: size, margin: 2, errorCorrectionLevel: 'M' });
    return { mimeType: 'image/png', dataUrl };
  }
  if (operation === 'imageResize') {
    const storage = await storageFor(ctx);
    const root = cleanRelative(String(binding.config.rootNamespace || 'shared'));
    const source = cleanRelative(String(input.file || ''));
    if (!(source === root || source.startsWith(`${root}/`))) throw new ServiceError('PERMISSION_DENIED', 'Source FileRef is outside the Media binding namespace', 403);
    const sourcePath = resolveWritePath(storage, source);
    const info = await stat(sourcePath).catch(() => null);
    const maxBytes = Number(binding.config.maxInputBytes || 20_971_520);
    if (!info?.isFile()) throw new ServiceError('TENANT_RESOURCE_UNAVAILABLE', 'Source FileRef is unavailable', 404);
    if (info.size > maxBytes) throw new ServiceError('SERVICE_INPUT_INVALID', 'Image exceeds the Media input limit', 413);
    const bytes = await readFile(sourcePath);
    const metadata = await sharp(bytes, { limitInputPixels: Number(binding.config.maxPixels || 24_000_000) }).metadata();
    if (!metadata.width || !metadata.height) throw new ServiceError('SERVICE_INPUT_INVALID', 'FileRef is not a supported image', 415);
    const format = input.format === 'png' || input.format === 'webp' ? input.format : 'jpeg';
    let pipeline = sharp(bytes, { limitInputPixels: Number(binding.config.maxPixels || 24_000_000) }).rotate().resize({ width: input.width ? Number(input.width) : undefined, height: input.height ? Number(input.height) : undefined, fit: input.fit || 'inside', withoutEnlargement: true });
    pipeline = format === 'png' ? pipeline.png({ quality: Number(input.quality || 90) }) : format === 'webp' ? pipeline.webp({ quality: Number(input.quality || 82) }) : pipeline.jpeg({ quality: Number(input.quality || 82), mozjpeg: true });
    const output = await pipeline.toBuffer();
    const checksum = createHash('sha256').update(output).digest('hex');
    const outputRoot = cleanRelative(path.posix.join(root, String(binding.config.outputPath || 'generated')));
    const fileName = `${checksum.slice(0, 16)}.${format === 'jpeg' ? 'jpg' : format}`;
    const relative = path.posix.join(outputRoot, fileName);
    const directory = resolveWritePath(storage, outputRoot);
    await mkdir(directory, { recursive: true });
    await writeFile(resolveWritePath(storage, relative), output, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    return { file: { assetId: relative, name: fileName, mimeType: `image/${format}`, size: output.length, checksum, url: storage.publicUrl(relative), provider: 'local-media' } };
  }
  throw new ServiceError('OPERATION_NOT_ALLOWED', `Unsupported Media operation '${operation}'`, 405);
}
