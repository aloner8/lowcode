import { describe, expect, it } from 'vitest';
import { compareMigrationInventories } from '../scripts/migration-compare.mjs';
import { INVENTORY_SOURCES, REFERENCE_CHECKS } from '../scripts/migration-inventory.mjs';

const inventory = () => ({
  schemaVersion: 'p7-migration-inventory.v1', mode: 'dry-run', readOnly: true,
  sources: INVENTORY_SOURCES.map(({ key, table }) => ({ key, table, status: 'AVAILABLE', count: 2, mapped: 2, unresolved: 0, checksum: 'a'.repeat(32) })),
  references: REFERENCE_CHECKS.map(({ key }) => ({ key, violations: 0 })),
  summary: { readyForApply: true },
});

describe('offline migration comparison', () => {
  it('matches by identity, never trusts summary or approves apply', () => {
    const after = inventory();
    after.sources.reverse();
    after.references.reverse();
    expect(compareMigrationInventories(inventory(), after)).toMatchObject({ metadataUnchanged: true, mappingsComplete: true, referencesClean: true, readyForApply: false });
  });
  it('detects checksum drift even with identical counts and reports unresolved mappings/references', () => {
    const after = inventory();
    Object.assign(after.sources[0], { checksum: 'b'.repeat(32), mapped: 1, unresolved: 1 });
    after.references[0].violations = 1;
    expect(compareMigrationInventories(inventory(), after)).toMatchObject({ metadataUnchanged: false, mappingsComplete: false, referencesClean: false });
  });
  it('detects row loss independently of checksum', () => {
    const after = inventory();
    Object.assign(after.sources[0], { count: 1, mapped: 1 });
    expect(compareMigrationInventories(inventory(), after).sources[0].status).toBe('CHANGED');
  });
  it.each(['missing', 'duplicate', 'negative', 'inconsistent', 'schema'])('rejects %s report data', (kind) => {
    const after = inventory();
    if (kind === 'missing') after.sources.pop();
    if (kind === 'duplicate') after.sources[0] = after.sources[1];
    if (kind === 'negative') after.references[0].violations = -1;
    if (kind === 'inconsistent') after.sources[0].unresolved = 1;
    if (kind === 'schema') after.schemaVersion = 'unknown';
    expect(() => compareMigrationInventories(inventory(), after)).toThrow();
  });
  it('reports unavailable tables without declaring metadata preserved', () => {
    const after = inventory();
    Object.assign(after.sources[0], { status: 'MISSING', count: null, mapped: null, unresolved: null, checksum: null });
    expect(compareMigrationInventories(inventory(), after)).toMatchObject({ metadataUnchanged: false, mappingsComplete: false, readyForApply: false });
  });
});
