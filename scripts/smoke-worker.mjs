import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { parseWorkerConfig, runWorkerOnce } from './service-worker.mjs';

let authorization = '';
const server = createServer((request, response) => {
  authorization = String(request.headers.authorization || '');
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ processed: 1, delivered: 1, failed: 0 }));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const config = parseWorkerConfig({ CONTROL_PLANE_INTERNAL_URL: `http://127.0.0.1:${address.port}`, SERVICE_WORKER_SECRET: 'container-smoke-secret' }, ['--once']);
  assert.deepEqual(await runWorkerOnce(config), { processed: 1, delivered: 1, failed: 0 });
  assert.equal(authorization, 'Bearer container-smoke-secret');
  console.log('Runtime worker smoke: entrypoint reaches the protected outbox contract');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
