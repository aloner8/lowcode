#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Input must be a quiescent, trusted offline asset snapshot, not a live tree.
export async function inventoryAssets(root) {
  const base = resolve(root);
  const files = [];
  const directories = [];
  async function walk(absolute, relative) {
    const initial = await lstat(absolute, { bigint: true });
    if (!initial.isDirectory() || initial.isSymbolicLink()) throw new Error('Expected snapshot directory');
    const names = (await readdir(absolute)).sort();
    for (const name of names) {
      const path = relative ? `${relative}/${name}` : name;
      const target = join(absolute, name);
      const stat = await lstat(target, { bigint: true });
      if (stat.isSymbolicLink()) throw new Error('Snapshot symlinks are not supported');
      if (stat.isDirectory()) {
        directories.push(path);
        await walk(target, path);
      } else if (stat.isFile()) {
        const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const before = await handle.stat({ bigint: true });
          if (!before.isFile() || before.ino !== stat.ino || before.dev !== stat.dev || before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Snapshot changed or unsupported file');
          const hash = createHash('sha256');
          let bytes = 0;
          for await (const chunk of handle.createReadStream({ autoClose: false })) {
            bytes += chunk.length;
            hash.update(chunk);
          }
          const after = await handle.stat({ bigint: true });
          if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(bytes) !== before.size) throw new Error('Snapshot changed during scan');
          files.push({ path, bytes, sha256: hash.digest('hex') });
        } finally {
          await handle.close();
        }
      } else throw new Error('Unsupported snapshot entry');
    }
    const final = await lstat(absolute, { bigint: true });
    if (initial.ino !== final.ino || initial.dev !== final.dev || initial.mtimeNs !== final.mtimeNs || initial.ctimeNs !== final.ctimeNs) throw new Error('Snapshot directory changed');
  }
  await walk(base, '');
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (!Number.isSafeInteger(totalBytes)) throw new Error('Snapshot too large');
  return {
    schemaVersion: 'p7-asset-inventory.v1', readOnly: true,
    files, directories, fileCount: files.length, totalBytes,
    checksum: createHash('sha256').update(JSON.stringify({ directories, files })).digest('hex'),
    readyForApply: false,
    limitations: ['Requires a quiescent trusted offline snapshot; not an atomic filesystem snapshot.', 'Does not inventory database assets, bindings, styles, permissions or prove restore readiness.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected snapshot root');
    process.stdout.write(`${JSON.stringify(await inventoryAssets(process.argv[2]), null, 2)}\n`);
  } catch {
    process.stderr.write('Asset inventory failed: provide a readable, stable offline directory without symlinks or special files.\n');
    process.exitCode = 1;
  }
}
