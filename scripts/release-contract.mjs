export const SHAREMODULE_TAG = /^sharemodule-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function versionFromReleaseTag(tag) {
  const match = SHAREMODULE_TAG.exec(String(tag || ''));
  if (!match) throw new Error("Release tag must match 'sharemodule-v<semver>'");
  return String(tag).slice('sharemodule-v'.length);
}

export function verifyReleaseContract({ rootPackage, sharePackage, exportedVersion, manifest, releaseTag, expectedGitSha }) {
  const errors = [];
  const dependencyVersion = rootPackage?.dependencies?.['@matchanu/sharemodule'];
  if (sharePackage?.private !== false) errors.push('ShareModule package must remain publishable (private=false)');
  if (dependencyVersion !== sharePackage?.version) errors.push('Root dependency must pin the exact ShareModule package version');
  if (exportedVersion !== sharePackage?.version) errors.push('SHAREMODULE_VERSION must match packages/sharemodule/package.json');
  if (manifest?.platformVersion !== rootPackage?.version) errors.push('Build manifest platformVersion does not match the root package');
  if (manifest?.shareModuleVersion !== sharePackage?.version) errors.push('Build manifest shareModuleVersion does not match the ShareModule package');
  if (!Number.isInteger(manifest?.configSchemaVersion) || manifest.configSchemaVersion < 1) errors.push('Build manifest configSchemaVersion is invalid');
  if (typeof manifest?.gitSha !== 'string' || !/^[0-9a-f]{40}$/i.test(manifest.gitSha)) errors.push('Build manifest gitSha is invalid');
  if (expectedGitSha && manifest?.gitSha !== expectedGitSha) errors.push('Build manifest gitSha does not match the release commit');
  if (typeof manifest?.builtAt !== 'string' || Number.isNaN(Date.parse(manifest.builtAt))) errors.push('Build manifest builtAt is invalid');
  if (releaseTag) {
    let tagVersion;
    try { tagVersion = versionFromReleaseTag(releaseTag); } catch (error) { errors.push(error.message); }
    if (tagVersion && tagVersion !== sharePackage?.version) errors.push(`Release tag ${releaseTag} does not match ShareModule ${sharePackage?.version}`);
  }
  return errors;
}
