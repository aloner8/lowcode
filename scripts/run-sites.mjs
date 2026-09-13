#!/usr/bin/env node
/**
 * Multi-site launcher.
 *
 * Reads the site registry from the core database and starts one Next.js process
 * per site, each bound to its own port and told which domains it answers to.
 * A site process serves only `/app/<slug>` (the middleware rewrites `/` onto it)
 * and refuses every control-plane route.
 *
 * Usage:
 *   node scripts/run-sites.mjs                 # production: .next/standalone
 *   node scripts/run-sites.mjs --dev           # development: next dev per site
 *   node scripts/run-sites.mjs --only=a,b      # only these app slugs
 *   node scripts/run-sites.mjs --list          # print the registry and exit
 *   node scripts/run-sites.mjs --port-base=34000
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getOption = (name, fallback = '') => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const DEV_MODE = hasFlag('dev');
const LIST_ONLY = hasFlag('list');
const ONLY = getOption('only').split(',').map((value) => value.trim()).filter(Boolean);
const PORT_BASE = Number(getOption('port-base', '0')) || 0;
const HOSTNAME = process.env.SITES_HOSTNAME || '0.0.0.0';
const RESTART_DELAY_MS = 2_000;
const MAX_RESTARTS = 10;
const RECONCILE_INTERVAL_MS = 3_000;
const HEALTH_RETRY_MS = 1_000;
const HEALTH_ATTEMPTS = 30;

const CORE_DATABASE_URL =
  process.env.CORE_DATABASE_URL ||
  'postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core';
const controllerPool = new Pool({ connectionString: CORE_DATABASE_URL, max: 3 });

/**
 * Where the standalone server lives depends on how the app was assembled:
 * a local `next build` leaves it under .next/standalone, while the Docker image
 * copies that directory to the working directory root.
 */
const SERVER_CANDIDATES = [
  path.resolve('server.js'),
  path.resolve('.next/standalone/server.js'),
];

const findStandaloneServer = () => SERVER_CANDIDATES.find((candidate) => existsSync(candidate));

const log = (message) => process.stdout.write(`[sites] ${message}\n`);
const logError = (message) => process.stderr.write(`[sites] ${message}\n`);

async function loadSites() {
  const result = await controllerPool.query(`
    SELECT registry.app_id, registry.app_slug, registry.app_name, registry.port,
           registry.subdomain, registry.tenant_db_name, registry.platform_id,
           registry.platform_slug, registry.domains,
           app.desired_state, app.observed_state
    FROM public.site_registry registry
    JOIN public.apps app ON app.id = registry.app_id
    WHERE registry.is_active = TRUE
    ORDER BY registry.port
  `);
  return result.rows;
}

/** hostname -> app slug, handed to each process so the Edge middleware can route by domain. */
function buildDomainMap(sites) {
  const map = {};
  for (const site of sites) {
    for (const domain of site.domains ?? []) map[domain] = site.app_slug;
  }
  return map;
}

function childEnv(site, port, domainMap) {
  return {
    ...process.env,
    PORT: String(port),
    HOSTNAME,
    SITE_SLUG: site.app_slug,
    SITE_NAME: site.app_name,
    SITE_DOMAINS: (site.domains ?? []).join(','),
    SITE_DOMAIN_MAP: JSON.stringify(domainMap),
    APP_SLUG: site.app_slug,
    APP_SURFACE: 'frontend',
    PLATFORM_ID: site.platform_id ?? '',
    PLATFORM_SLUG: site.platform_slug ?? '',
    TENANT_DB_NAME: site.tenant_db_name,
    CORE_DATABASE_URL,
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

const children = new Map();
const restartState = new Map();
let shuttingDown = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const reportAsync = (promise, label) => {
  void promise.catch((error) => logError(`${label}: ${error instanceof Error ? error.message : String(error)}`));
};

function scheduleRestart(slug) {
  const state = restartState.get(slug) ?? { restarts: 0, nextAt: 0 };
  state.restarts += 1;
  state.nextAt = Date.now() + RESTART_DELAY_MS;
  restartState.set(slug, state);
  return state;
}

async function finishOperation(appId, type, status, checkpoint, error = null) {
  await controllerPool.query(`
    UPDATE public.app_operations
       SET status = $3, checkpoint = $4, error_detail = $5,
           finished_at = CASE WHEN $3 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE finished_at END
     WHERE id = (
       SELECT id FROM public.app_operations
       WHERE app_id = $1 AND operation_type = $2 AND status = 'RUNNING'
       ORDER BY created_at DESC LIMIT 1
     )
  `, [appId, type, status, checkpoint, error]);
}

async function markFailed(site, message) {
  await controllerPool.query(`UPDATE public.apps
    SET observed_state = 'FAILED', runtime_pid = NULL,
        runtime_error_detail = $2, health_checked_at = NOW()
    WHERE id = $1`, [site.app_id, message.slice(0, 4000)]);
  await finishOperation(site.app_id, 'START', 'FAILED', 'HEALTH_FAILED', message.slice(0, 4000));
}

async function waitForHealthy(site, entry) {
  for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
    if (shuttingDown || entry.child.exitCode !== null || entry.requestedStop) return;
    try {
      const response = await fetch(`http://127.0.0.1:${entry.port}/api/runtime/${encodeURIComponent(site.app_slug)}/health`);
      if (response.ok) {
        const payload = await response.json();
        if (payload.status === 'healthy') {
          const update = await controllerPool.query(`UPDATE public.apps
            SET observed_state = 'RUNNING', runtime_pid = $2,
                runtime_started_at = NOW(), health_checked_at = NOW(),
                runtime_metrics = $3::jsonb, runtime_metrics_at = NOW(),
                runtime_error_detail = NULL
            WHERE id = $1 AND desired_state = 'RUNNING'`,
          [site.app_id, entry.child.pid ?? null, JSON.stringify(payload.metrics ?? {})]);
          if (!update.rowCount) return;
          await finishOperation(site.app_id, 'START', 'COMPLETED', 'HEALTHY');
          entry.healthy = true;
          restartState.set(site.app_slug, { restarts: 0, nextAt: 0 });
          log(`${site.app_slug} passed health check on :${entry.port}`);
          return;
        }
      }
    } catch {
      // The process may still be warming up.
    }
    await delay(HEALTH_RETRY_MS);
  }
  const message = `Health check failed after ${HEALTH_ATTEMPTS} attempts`;
  entry.healthFailed = true;
  scheduleRestart(site.app_slug);
  await markFailed(site, message);
  entry.child.kill('SIGTERM');
}

async function sampleHealth(site, entry) {
  if (entry.child.exitCode !== null || entry.requestedStop) return;
  try {
    const response = await fetch(`http://127.0.0.1:${entry.port}/api/runtime/${encodeURIComponent(site.app_slug)}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    await controllerPool.query(`UPDATE public.apps
      SET health_checked_at = NOW(), runtime_metrics = $2::jsonb,
          runtime_metrics_at = NOW(), runtime_error_detail = NULL
      WHERE id = $1 AND observed_state = 'RUNNING'`,
    [site.app_id, JSON.stringify(payload.metrics ?? {})]);
  } catch (error) {
    await controllerPool.query(`UPDATE public.apps
      SET health_checked_at = NOW(), runtime_metrics = NULL, runtime_metrics_at = NULL,
          runtime_error_detail = $2
      WHERE id = $1`, [site.app_id, `Health unavailable: ${error instanceof Error ? error.message : String(error)}`]);
  }
}

function startSite(site, domainMap) {
  const port = PORT_BASE ? PORT_BASE + (site.port % 1000) : site.port;
  const env = childEnv(site, port, domainMap);

  const command = DEV_MODE ? 'npx' : process.execPath;
  const commandArgs = DEV_MODE ? ['next', 'dev', '-p', String(port)] : [findStandaloneServer()];

  const child = spawn(command, commandArgs, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `${site.app_slug}:${port}`;
  const entry = {
    child,
    port,
    site,
    requestedStop: false,
    healthFailed: false,
    healthy: false,
    metricsTimer: null,
  };

  child.stdout.on('data', (chunk) => process.stdout.write(`[${prefix}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${prefix}] ${chunk}`));
  child.on('error', (error) => {
    entry.healthFailed = true;
    scheduleRestart(site.app_slug);
    reportAsync(markFailed(site, `Unable to spawn process: ${error.message}`), `unable to mark ${site.app_slug} failed`);
  });

  children.set(site.app_slug, entry);

  reportAsync((async () => {
    const update = await controllerPool.query(`UPDATE public.apps
      SET observed_state = 'STARTING', runtime_pid = $2, runtime_error_detail = NULL
      WHERE id = $1 AND desired_state = 'RUNNING'`, [site.app_id, child.pid ?? null]);
    if (!update.rowCount || entry.child.exitCode !== null || entry.healthFailed || entry.requestedStop) return;
    await waitForHealthy(site, entry);
    if (entry.child.exitCode === null && !entry.requestedStop && !entry.healthFailed) {
      entry.metricsTimer = setInterval(() => {
        reportAsync(sampleHealth(site, entry), `health sample failed for ${site.app_slug}`);
      }, 30_000);
    }
  })(), `health gate failed for ${site.app_slug}`);

  child.on('exit', (code, signal) => {
    if (entry.metricsTimer) clearInterval(entry.metricsTimer);
    children.delete(site.app_slug);
    if (shuttingDown) return;
    if (entry.requestedStop) {
      restartState.set(site.app_slug, { restarts: 0, nextAt: 0 });
      reportAsync(controllerPool.query(`UPDATE public.apps
        SET observed_state = 'STOPPED', runtime_pid = NULL, runtime_stopped_at = NOW(),
            runtime_metrics = NULL, runtime_metrics_at = NULL, runtime_error_detail = NULL
        WHERE id = $1`, [site.app_id]), `unable to mark ${site.app_slug} stopped`);
      reportAsync(finishOperation(site.app_id, 'STOP', 'COMPLETED', 'PROCESS_STOPPED'), `unable to finish Stop for ${site.app_slug}`);
      log(`stopped ${prefix}`);
      return;
    }
    if (entry.healthFailed) return;
    const state = scheduleRestart(site.app_slug);
    const message = `${prefix} exited (${code ?? signal}) [${state.restarts}/${MAX_RESTARTS}]`;
    reportAsync(markFailed(site, message), `unable to record ${site.app_slug} exit`);
    logError(message);
  });

  const domainList = (site.domains ?? []).join(', ') || '(no ready domain)';
  log(`started ${site.app_slug} on :${port} → ${domainList}`);
}

function stopSite(entry) {
  if (entry.requestedStop || entry.child.exitCode !== null) return;
  entry.requestedStop = true;
  entry.child.kill('SIGTERM');
  setTimeout(() => {
    if (entry.child.exitCode === null) entry.child.kill('SIGKILL');
  }, 5_000).unref();
}

async function reconcile() {
  const sites = await loadSites();
  const selected = ONLY.length ? sites.filter((site) => ONLY.includes(site.app_slug)) : sites;
  const bySlug = new Map(selected.map((site) => [site.app_slug, site]));
  const domainMap = buildDomainMap(selected);

  for (const [slug, entry] of children) {
    const site = bySlug.get(slug);
    if (!site || site.desired_state !== 'RUNNING') stopSite(entry);
  }
  for (const site of selected) {
    if (site.desired_state !== 'RUNNING' || children.has(site.app_slug)) continue;
    const state = restartState.get(site.app_slug) ?? { restarts: 0, nextAt: 0 };
    if (state.restarts >= MAX_RESTARTS || Date.now() < state.nextAt) continue;
    startSite(site, domainMap);
  }
  for (const site of selected) {
    if (site.desired_state === 'STOPPED' && !children.has(site.app_slug)
        && ['STOPPING', 'STOPPED', 'UNPROVISIONED'].includes(site.observed_state)) {
      restartState.set(site.app_slug, { restarts: 0, nextAt: 0 });
      if (site.observed_state === 'STOPPING') {
        await controllerPool.query(`UPDATE public.apps SET observed_state='STOPPED', runtime_pid=NULL,
          runtime_stopped_at=NOW(), runtime_metrics=NULL, runtime_metrics_at=NULL WHERE id=$1`, [site.app_id]);
      }
      await finishOperation(site.app_id, 'STOP', 'COMPLETED', 'PROCESS_STOPPED');
    }
    const entry = children.get(site.app_slug);
    if (site.desired_state === 'RUNNING' && entry?.healthy && site.observed_state === 'RUNNING') {
      await finishOperation(site.app_id, 'START', 'COMPLETED', 'HEALTHY');
    }
  }
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}, stopping ${children.size} site(s)…`);

  for (const [slug, entry] of children) {
    if (!entry.child || entry.child.exitCode !== null) continue;
    entry.child.kill('SIGTERM');
    // Escalate if a child ignores SIGTERM.
    setTimeout(() => {
      if (entry.child.exitCode === null) {
        logError(`${slug} did not stop gracefully — sending SIGKILL`);
        entry.child.kill('SIGKILL');
      }
    }, 5_000).unref();
  }

  setTimeout(() => process.exit(0), 6_000).unref();
}

async function main() {
  let sites = await loadSites();
  if (ONLY.length) sites = sites.filter((site) => ONLY.includes(site.app_slug));

  if (LIST_ONLY) {
    for (const site of sites) {
      log(`${site.app_slug.padEnd(24)} :${site.port}  ${(site.domains ?? []).join(', ') || '(no ready domain)'}`);
    }
    await controllerPool.end();
    return;
  }

  if (!DEV_MODE && !findStandaloneServer()) {
    logError(`No standalone server found (looked in: ${SERVER_CANDIDATES.join(', ')}). Run "npm run build" first, or pass --dev.`);
    process.exit(1);
  }

  const domainMap = buildDomainMap(sites);
  const runnable = sites.filter((site) => site.desired_state === 'RUNNING');
  log(`launching ${runnable.length} running site(s) in ${DEV_MODE ? 'development' : 'production'} mode`);
  for (const site of runnable) startSite(site, domainMap);
  setInterval(() => void reconcile().catch((error) => logError(`reconcile failed: ${error instanceof Error ? error.message : String(error)}`)), RECONCILE_INTERVAL_MS);

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logError(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
