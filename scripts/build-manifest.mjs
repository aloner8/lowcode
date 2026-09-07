import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const platform = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const sharePackage = JSON.parse(readFileSync(new URL('packages/sharemodule/package.json', root), 'utf8'));
let gitSha = process.env.BUILD_GIT_SHA;
if (!gitSha) {
  try { gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { gitSha = 'unknown'; }
}
mkdirSync(new URL('src/generated/', root), { recursive: true });
writeFileSync(new URL('src/generated/build-manifest.json', root), JSON.stringify({
  platformVersion: platform.version, shareModuleVersion: sharePackage.version,
  gitSha, builtAt: new Date().toISOString(), configSchemaVersion: 1,
}, null, 2) + '\n');
