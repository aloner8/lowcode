import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { parseWorkerConfig, runWorkerOnce } from '../scripts/service-worker.mjs';

const servers: Array<ReturnType<typeof createServer>> = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

describe('outbox worker entrypoint', () => {
  it('calls the internal endpoint once with the protected header and bounded batch size', async () => {
    let authorization = ''; let requestUrl = '';
    const server = createServer((request, response) => {
      authorization = String(request.headers.authorization || ''); requestUrl = String(request.url || '');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ processed: 2, delivered: 1, failed: 1 }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test worker server did not bind');
    const config = parseWorkerConfig({ CONTROL_PLANE_INTERNAL_URL: `http://127.0.0.1:${address.port}`, SERVICE_WORKER_SECRET: 'worker-secret', SERVICE_WORKER_BATCH_SIZE: '500' }, ['--once']);
    await expect(runWorkerOnce(config)).resolves.toEqual({ processed: 2, delivered: 1, failed: 1 });
    expect(authorization).toBe('Bearer worker-secret');
    expect(new URL(requestUrl, 'http://worker.test').searchParams.get('limit')).toBe('20');
  });

  it('rejects URLs containing credentials and requires a worker secret', () => {
    expect(() => parseWorkerConfig({ CONTROL_PLANE_INTERNAL_URL: 'https://user:password@example.test', SERVICE_WORKER_SECRET: 'secret' })).toThrow(/without credentials/);
    expect(() => parseWorkerConfig({ CONTROL_PLANE_INTERNAL_URL: 'https://example.test' })).toThrow(/SERVICE_WORKER_SECRET/);
  });

  it('rejects malformed endpoint results', async () => {
    const config = parseWorkerConfig({ CONTROL_PLANE_INTERNAL_URL: 'https://example.test', SERVICE_WORKER_SECRET: 'secret' }, ['--once']);
    await expect(runWorkerOnce(config, async () => new Response(JSON.stringify({ processed: 'many' }), { status: 200 }))).rejects.toThrow(/invalid worker result/);
  });
});
