// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { compareAssetInventories } from '../scripts/migration-assets-compare.mjs';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const file = (path: string, content = 'one') => ({ path, bytes: Buffer.byteLength(content), sha256: hash(content) });
function manifest(files = [file('folder/a')], directories = ['folder']) {
  return {
    schemaVersion: 'p7-asset-inventory.v1', readOnly: true, readyForApply: false,
    directories, files, fileCount: files.length, totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
    checksum: hash(JSON.stringify({ directories, files })),
  };
}

describe('offline asset comparison', () => {
  it('compares independently of entry order without approving apply', () => {
    expect(compareAssetInventories(manifest([file('a'), file('b')], []), manifest([file('b'), file('a')], []))).toMatchObject({ assetsUnchanged: true, changes: [], readyForApply: false });
  });
  it('detects same-size changes, removals, additions and empty directory loss', () => {
    const before = manifest([file('a'), file('removed')], ['empty']);
    const after = manifest([file('a', 'two'), file('added')], []);
    expect(compareAssetInventories(before, after).changes.map(({ path, status }) => [path, status])).toEqual([
      ['a', 'CONTENT_CHANGED'], ['added', 'ADDED'], ['empty', 'REMOVED'], ['removed', 'REMOVED'],
    ]);
  });
  it('reports a directory replaced by a file', () => {
    expect(compareAssetInventories(manifest([], ['folder']), manifest([file('folder')], [])).changes[0].status).toBe('TYPE_CHANGED');
  });
  it.each(['../escape', '/absolute', 'a//b', './a', 'a/../b', 'a\0b'])('rejects malformed path %s', (path) => {
    expect(() => compareAssetInventories(manifest(), manifest([file(path)], []))).toThrow();
  });
  it('rejects missing parents, duplicate paths and file/directory collisions', () => {
    for (const invalid of [manifest([file('missing/a')], []), manifest([file('a'), file('a')], []), manifest([file('folder')])]) {
      expect(() => compareAssetInventories(manifest(), invalid)).toThrow();
    }
  });
  it('rejects tampered summary, checksum, hash, size and approval fields', () => {
    for (const change of [{ fileCount: 5 }, { totalBytes: 0 }, { checksum: '0'.repeat(64) }, { readOnly: false }, { readyForApply: true }, { schemaVersion: 'other' }]) {
      expect(() => compareAssetInventories(manifest(), { ...manifest(), ...change })).toThrow();
    }
    for (const entry of [{ ...file('a'), bytes: -1 }, { ...file('a'), sha256: 'bad' }]) {
      expect(() => compareAssetInventories(manifest(), manifest([entry], []))).toThrow();
    }
  });
  it('never calls matching empty manifests ready to apply', () => {
    expect(compareAssetInventories(manifest([], []), manifest([], []))).toMatchObject({ assetsUnchanged: true, readyForApply: false });
  });
});
