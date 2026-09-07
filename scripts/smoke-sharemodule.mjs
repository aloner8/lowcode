import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { SHAREMODULE_VERSION } from '@matchanu/sharemodule';
import { createModules } from '@matchanu/sharemodule/client';
import { selectModuleBinding } from '@matchanu/sharemodule/server';
import { FileManager, Login } from '@matchanu/sharemodule/react';

const manifest = JSON.parse(readFileSync(new URL('../packages/sharemodule/package.json', import.meta.url), 'utf8'));
assert.equal(SHAREMODULE_VERSION, manifest.version);
assert.equal(typeof FileManager, 'function');
assert.equal(typeof Login, 'function');
assert.throws(() => selectModuleBinding([], 'auth.session'));
const modules = createModules({ fetch: async () => new Response(JSON.stringify({ data: { user: { roles: [], permissions: ['documents.read'] } } })) });
assert.equal(await modules.auth.can('documents.read'), true);
console.log(`ShareModule ${SHAREMODULE_VERSION}: compiled client, server and React exports are available`);

if (process.argv.includes('--http')) {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url), stdio: 'ignore',
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '33000' },
  });
  let launchError;
  server.on('error', error => { launchError = error; });
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (launchError) throw launchError;
      response = await fetch('http://127.0.0.1:33000/api/share/v1/system/version', { signal: AbortSignal.timeout(1000) }).catch(() => undefined);
      if (response) break;
      await delay(250);
    }
    assert.equal(response?.status, 401, 'Version endpoint must require authentication');
    const denied = await fetch('http://127.0.0.1:33000/api/share/v1/auth/login', {
      method: 'POST', headers: { Origin: 'https://another-site.invalid', 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(denied.status, 403, 'Cross-origin module mutations must be rejected');
    console.log('Runtime HTTP smoke: server starts; authentication and origin guards are active');
  } finally { server.kill(); }
}
