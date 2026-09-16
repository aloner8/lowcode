import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const integerInRange = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

/**
 * @param {Record<string, string | undefined>} env
 * @param {string[]} argv
 */
export function parseWorkerConfig(env = process.env, argv = process.argv.slice(2)) {
  const baseUrl = new URL(env.CONTROL_PLANE_INTERNAL_URL || 'http://127.0.0.1:33000');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('CONTROL_PLANE_INTERNAL_URL must be an HTTP(S) origin without credentials');
  }
  if (!env.SERVICE_WORKER_SECRET) throw new Error('SERVICE_WORKER_SECRET is required');
  return {
    baseUrl,
    secret: env.SERVICE_WORKER_SECRET,
    limit: integerInRange(env.SERVICE_WORKER_BATCH_SIZE, 20, 1, 100),
    intervalMs: integerInRange(env.SERVICE_WORKER_INTERVAL_MS, 5_000, 250, 300_000),
    requestTimeoutMs: integerInRange(env.SERVICE_WORKER_REQUEST_TIMEOUT_MS, 30_000, 1_000, 120_000),
    once: argv.includes('--once') || env.SERVICE_WORKER_RUN_ONCE === 'true',
  };
}

export async function runWorkerOnce(config, fetchImpl = fetch) {
  const endpoint = new URL('/api/internal/service-outbox', config.baseUrl);
  endpoint.searchParams.set('limit', String(config.limit));
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.secret}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`Outbox endpoint returned HTTP ${response.status}`);
  const result = await response.json();
  if (!result || !['processed', 'delivered', 'failed'].every((key) => Number.isInteger(result[key]) && result[key] >= 0)) {
    throw new Error('Outbox endpoint returned an invalid worker result');
  }
  return result;
}

export async function runWorkerLoop(config, options = {}) {
  const logger = options.logger || console;
  const signal = options.signal;
  let failures = 0;
  do {
    if (signal?.aborted) break;
    try {
      const result = await runWorkerOnce(config, options.fetchImpl);
      failures = 0;
      logger.info(`outbox processed=${result.processed} delivered=${result.delivered} failed=${result.failed}`);
    } catch (error) {
      failures += 1;
      logger.error(`outbox worker error: ${error instanceof Error ? error.message : 'unknown error'}`);
      if (config.once) throw error;
    }
    if (config.once || signal?.aborted) break;
    const backoff = Math.min(config.intervalMs * (2 ** Math.min(failures, 5)), 300_000);
    await delay(backoff, undefined, { signal }).catch((error) => { if (error?.name !== 'AbortError') throw error; });
  } while (!signal?.aborted);
}

async function main() {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  await runWorkerLoop(parseWorkerConfig(), { signal: controller.signal });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Worker failed'); process.exitCode = 1; });
}
