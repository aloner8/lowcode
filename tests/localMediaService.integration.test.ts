import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ServiceExecutionContext } from '@/lib/services/runtimeContext';
import type { StudioServiceDefinition } from '@/types';

const state = vi.hoisted(() => ({ root: '' }));
vi.mock('@/lib/storage/tenantStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/tenantStorage')>();
  return { ...actual, resolveTenantStorage: vi.fn(async () => ({ writeRoot: state.root, readRoots: [state.root], tenantDbName: 'app_media_test', publicUrl: (relative: string) => `/files/${relative}` })) };
});

import { executeLocalMediaService } from '@/lib/services/localMediaService';

const ctx = { scope: { platformId: 'platform-a', appId: 'app-a', tenantId: 'app-a', authRealm: 'tenant' } } as ServiceExecutionContext;
const binding = { id: 'media.local', name: 'Media', kind: 'media', enabled: true, serviceRef: { serviceKey: 'media.local', version: '1.0.0' }, config: { rootNamespace: 'shared', outputPath: 'generated', maxInputBytes: 1024 * 1024, maxPixels: 1_000_000 }, policy: { allowedOperations: ['qrCode', 'imageResize'] }, containerBindings: [] } as StudioServiceDefinition;

beforeAll(async () => { state.root = await mkdtemp(path.join(tmpdir(), 'lowcode-media-')); });
afterAll(async () => { await rm(state.root, { recursive: true, force: true }); });

describe('local Media service', () => {
  it('generates a self-contained QR image without provider credentials', async () => {
    const result = await executeLocalMediaService(ctx, binding, 'qrCode', { value: 'https://example.test/r/42', size: 128, format: 'svg' }) as { mimeType: string; dataUrl: string };
    expect(result.mimeType).toBe('image/svg+xml');
    expect(Buffer.from(result.dataUrl.split(',')[1], 'base64').toString()).toContain('<svg');
  });

  it('resizes a real tenant image and writes a content-addressed FileRef', async () => {
    await mkdir(path.join(state.root, 'shared'), { recursive: true });
    await writeFile(path.join(state.root, 'shared', 'source.png'), await sharp({ create: { width: 80, height: 40, channels: 4, background: '#336699' } }).png().toBuffer());
    const result = await executeLocalMediaService(ctx, binding, 'imageResize', { file: 'shared/source.png', width: 20, format: 'webp' }) as { file: { assetId: string; size: number; checksum: string } };
    expect(result.file.assetId).toMatch(/^shared\/generated\/[a-f0-9]{16}\.webp$/);
    const output = await readFile(path.join(state.root, result.file.assetId));
    expect((await sharp(output).metadata()).width).toBe(20);
    expect(result.file.size).toBe(output.length);
    expect(result.file.checksum).toHaveLength(64);
  });

  it('rejects FileRefs outside the binding namespace', async () => {
    await expect(executeLocalMediaService(ctx, binding, 'imageResize', { file: 'private/source.png', width: 20 })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
