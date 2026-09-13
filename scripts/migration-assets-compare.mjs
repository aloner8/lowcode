#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const size = (value) => Number.isSafeInteger(value) && value >= 0;
const validPath = (value) => typeof value === 'string' && !value.includes('\0') && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');

function validate(report) {
  if (report?.schemaVersion !== 'p7-asset-inventory.v1' || report.readOnly !== true || report.readyForApply !== false || !Array.isArray(report.files) || !Array.isArray(report.directories)) throw new Error('Invalid manifest');
  const files = report.files.map((file) => {
    if (!file || !validPath(file.path) || !size(file.bytes) || !digest(file.sha256)) throw new Error('Invalid file');
    return { path: file.path, bytes: file.bytes, sha256: file.sha256 };
  });
  const directories = report.directories;
  if (!directories.every(validPath)) throw new Error('Invalid directory');
  const paths = [...directories, ...files.map((file) => file.path)];
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate or conflicting path');
  const parents = new Set(directories);
  for (const path of paths) {
    const separator = path.lastIndexOf('/');
    if (separator !== -1 && !parents.has(path.slice(0, separator))) throw new Error('Missing parent directory');
  }
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  if (!size(total) || report.totalBytes !== total || report.fileCount !== files.length) throw new Error('Invalid totals');
  const checksum = createHash('sha256').update(JSON.stringify({ directories, files })).digest('hex');
  if (!digest(report.checksum) || checksum !== report.checksum) throw new Error('Checksum mismatch');
  return new Map([...directories.map((path) => [path, { type: 'directory' }]), ...files.map((file) => [file.path, { type: 'file', bytes: file.bytes, sha256: file.sha256 }])]);
}

export function compareAssetInventories(before, after) {
  const left = validate(before);
  const right = validate(after);
  const changes = [];
  for (const path of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const previous = left.get(path);
    const current = right.get(path);
    const status = !previous ? 'ADDED' : !current ? 'REMOVED' : previous.type !== current.type ? 'TYPE_CHANGED' : previous.type === 'file' && (previous.bytes !== current.bytes || previous.sha256 !== current.sha256) ? 'CONTENT_CHANGED' : null;
    if (status) changes.push({ path, status, before: previous ?? null, after: current ?? null });
  }
  return {
    schemaVersion: 'p7-asset-comparison.v1', readOnly: true,
    assetsUnchanged: changes.length === 0, changes, readyForApply: false,
    limitations: ['Compares supplied manifests only; matching checksums do not authenticate their origin.', 'Does not prove DB assets, binding/style semantics, permissions, staging behavior or restore readiness.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Expected two manifests');
    const reports = await Promise.all(process.argv.slice(2).map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
    const result = compareAssetInventories(...reports);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.assetsUnchanged ? 0 : 2;
  } catch {
    process.stderr.write('Asset comparison failed: provide two valid asset inventory JSON files.\n');
    process.exitCode = 1;
  }
}
