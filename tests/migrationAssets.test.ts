// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inventoryAssets } from '../scripts/migration-assets.mjs';

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'p7-assets-'));
  roots.push(root);
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('offline asset inventory', () => {
  it('hashes binary payloads, preserves empty directories and is deterministic without writing input', async () => {
    const root = await fixture();
    await mkdir(join(root, 'empty'));
    const bytes = Buffer.from([0, 255, 1, 128]);
    await writeFile(join(root, 'image.bin'), bytes);
    const report = await inventoryAssets(root);
    expect(report.files).toEqual([{ path: 'image.bin', bytes: 4, sha256: createHash('sha256').update(bytes).digest('hex') }]);
    expect(report.directories).toEqual(['empty']);
    expect(report.totalBytes).toBe(4);
    expect(await inventoryAssets(root)).toEqual(report);
    expect(await readFile(join(root, 'image.bin'))).toEqual(bytes);
    expect(JSON.stringify(report)).not.toContain(root);
  });
  it('detects same-size content changes and path changes', async () => {
    const root = await fixture();
    await writeFile(join(root, 'a'), 'one');
    const first = await inventoryAssets(root);
    await writeFile(join(root, 'a'), 'two');
    const second = await inventoryAssets(root);
    expect(second.checksum).not.toBe(first.checksum);
    await rm(join(root, 'a'));
    await writeFile(join(root, 'b'), 'two');
    expect((await inventoryAssets(root)).checksum).not.toBe(second.checksum);
  });
  it('rejects file, directory and root symlinks instead of scanning outside the snapshot', async () => {
    const root = await fixture();
    const outside = await fixture();
    await writeFile(join(outside, 'private'), 'not for manifest');
    await symlink(join(outside, 'private'), join(root, 'link'));
    await expect(inventoryAssets(root)).rejects.toThrow();
    await rm(join(root, 'link'));
    await symlink(outside, join(root, 'link'));
    await expect(inventoryAssets(root)).rejects.toThrow();
    await expect(inventoryAssets(join(root, 'link'))).rejects.toThrow();
  });
  it('rejects special files without blocking', async () => {
    const root = await fixture();
    execFileSync('mkfifo', [join(root, 'pipe')]);
    await expect(inventoryAssets(root)).rejects.toThrow();
  });
  it('does not approve migration even for an empty directory', async () => {
    expect(await inventoryAssets(await fixture())).toMatchObject({ fileCount: 0, totalBytes: 0, readyForApply: false });
  });
});
