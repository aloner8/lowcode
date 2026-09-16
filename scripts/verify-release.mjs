import { readFile } from 'node:fs/promises';
import { SHAREMODULE_VERSION } from '@matchanu/sharemodule';
import { verifyReleaseContract } from './release-contract.mjs';

const readJson = async (relative) => JSON.parse(await readFile(new URL(`../${relative}`, import.meta.url), 'utf8'));
const rootPackage = await readJson('package.json');
const sharePackage = await readJson('packages/sharemodule/package.json');
const manifest = await readJson('src/generated/build-manifest.json');
const releaseTag = process.env.RELEASE_TAG || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '');
const errors = verifyReleaseContract({ rootPackage, sharePackage, exportedVersion: SHAREMODULE_VERSION, manifest, releaseTag, expectedGitSha: process.env.BUILD_GIT_SHA });
if (errors.length) {
  for (const error of errors) console.error(`release contract: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Release contract verified: platform ${rootPackage.version}, ShareModule ${sharePackage.version}${releaseTag ? `, tag ${releaseTag}` : ''}`);
}
