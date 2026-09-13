#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { INVENTORY_SOURCES, REFERENCE_CHECKS } from './migration-inventory.mjs';

const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
function validate(report) {
  if (report?.schemaVersion !== 'p7-migration-inventory.v1' || report.readOnly !== true || report.mode !== 'dry-run') throw new Error('Unsupported inventory report');
  for (const [field, expected] of [['sources', INVENTORY_SOURCES], ['references', REFERENCE_CHECKS]]) {
    const rows = report[field];
    if (!Array.isArray(rows) || rows.length !== expected.length || expected.some(({ key }) => rows.filter((row) => row?.key === key).length !== 1)) throw new Error('Incomplete or duplicate inventory entries');
  }
  for (const row of report.sources) {
    if (row.table !== INVENTORY_SOURCES.find(({ key }) => key === row.key).table) throw new Error('Unexpected source table');
    if (row.status === 'MISSING') {
      if (['count', 'mapped', 'unresolved', 'checksum'].some((key) => row[key] !== null)) throw new Error('Invalid missing source');
    } else if (row.status !== 'AVAILABLE' || ![row.count, row.mapped, row.unresolved].every(nonnegative) || row.mapped > row.count || row.unresolved !== row.count - row.mapped || !/^[a-f0-9]{32}$/.test(row.checksum)) throw new Error('Invalid source measurements');
  }
  if (report.references.some((row) => !nonnegative(row.violations))) throw new Error('Invalid reference measurements');
}

export function compareMigrationInventories(before, after) {
  validate(before);
  validate(after);
  const sources = INVENTORY_SOURCES.map(({ key }) => {
    const left = before.sources.find((row) => row.key === key);
    const right = after.sources.find((row) => row.key === key);
    return {
      key,
      status: left.status !== 'AVAILABLE' || right.status !== 'AVAILABLE' ? 'UNAVAILABLE' : left.count === right.count && left.checksum === right.checksum ? 'UNCHANGED' : 'CHANGED',
      beforeCount: left.count, afterCount: right.count,
      beforeUnresolved: left.unresolved, afterUnresolved: right.unresolved,
    };
  });
  const references = REFERENCE_CHECKS.map(({ key }) => ({
    key,
    before: before.references.find((row) => row.key === key).violations,
    after: after.references.find((row) => row.key === key).violations,
  }));
  return {
    schemaVersion: 'p7-migration-comparison.v1', sources, references,
    metadataUnchanged: sources.every((row) => row.status === 'UNCHANGED'),
    mappingsComplete: sources.every((row) => row.afterUnresolved === 0),
    referencesClean: references.every((row) => row.after === 0),
    readyForApply: false,
    limitations: ['Metadata checksums do not cover business payloads, assets or styles.', 'Staging conversion and backup/restore rehearsal remain required.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Expected two inventory paths');
    const [before, after] = await Promise.all(process.argv.slice(2).map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
    const report = compareMigrationInventories(before, after);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.metadataUnchanged && report.mappingsComplete && report.referencesClean ? 0 : 2;
  } catch {
    // Do not echo input contents or parser messages from potentially private reports.
    process.stderr.write('Inventory comparison failed: provide two valid inventory JSON files.\n');
    process.exitCode = 1;
  }
}
