import { describe, expect, it } from 'vitest';
import { verifyReleaseContract, versionFromReleaseTag } from '../scripts/release-contract.mjs';

const valid = {
  rootPackage: { version: '0.1.0', dependencies: { '@matchanu/sharemodule': '0.4.0' } },
  sharePackage: { version: '0.4.0', private: false },
  exportedVersion: '0.4.0',
  manifest: { platformVersion: '0.1.0', shareModuleVersion: '0.4.0', configSchemaVersion: 1, gitSha: 'a'.repeat(40), builtAt: '2026-09-16T00:00:00.000Z' },
};

describe('release contract', () => {
  it('accepts independently-versioned platform and ShareModule artifacts', () => {
    expect(verifyReleaseContract({ ...valid, releaseTag: 'sharemodule-v0.4.0', expectedGitSha: 'a'.repeat(40) })).toEqual([]);
    expect(versionFromReleaseTag('sharemodule-v1.2.3-rc.1')).toBe('1.2.3-rc.1');
  });

  it('rejects dependency, export, manifest and tag drift', () => {
    const errors = verifyReleaseContract({
      ...valid,
      rootPackage: { ...valid.rootPackage, dependencies: { '@matchanu/sharemodule': '^0.3.0' } },
      exportedVersion: '0.3.0',
      manifest: { platformVersion: '9.0.0', shareModuleVersion: '0.3.0', configSchemaVersion: 0, gitSha: 'invalid', builtAt: 'not-a-date' },
      releaseTag: 'sharemodule-v0.5.0',
      expectedGitSha: 'b'.repeat(40),
    });
    expect(errors).toHaveLength(9);
    expect(errors.join('\n')).toContain('Root dependency');
    expect(errors.join('\n')).toContain('does not match ShareModule');
  });

  it('rejects ambiguous release tags', () => {
    expect(() => versionFromReleaseTag('v0.4.0')).toThrow(/sharemodule-v/);
    expect(() => versionFromReleaseTag('sharemodule-v01.2.3')).toThrow(/sharemodule-v/);
  });
});
