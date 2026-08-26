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

const CORE_DATABASE_URL =
  process.env.CORE_DATABASE_URL ||
  'postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core';

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
  const pool = new Pool({ connectionString: CORE_DATABASE_URL, max: 2 });
  try {
    const result = await pool.query(`
      SELECT app_slug, app_name, port, subdomain, tenant_db_name,
             platform_id, platform_slug, domains
      FROM public.site_registry
      WHERE is_active = TRUE
      ORDER BY port
    `);
    return result.rows;
  } finally {
    await pool.end();
  }
}

/** hostname -> app slug, handed to each process so the Edge middleware can route by domain. */
function buildDomainMap(sites) {
  const map = {};
  for (const site of sites) {
    for (const domain of site.domains ?? []) map[domain] = site.app_slug;
    if (site.subdomain) map[String(site.subdomain).toLowerCase()] = site.app_slug;
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
let shuttingDown = false;

function startSite(site, domainMap) {
  const port = PORT_BASE ? PORT_BASE + (site.port % 1000) : site.port;
  const env = childEnv(site, port, domainMap);

  const command = DEV_MODE ? 'npx' : process.execPath;
  const commandArgs = DEV_MODE ? ['next', 'dev', '-p', String(port)] : [findStandaloneServer()];

  const child = spawn(command, commandArgs, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `${site.app_slug}:${port}`;

  child.stdout.on('data', (chunk) => process.stdout.write(`[${prefix}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${prefix}] ${chunk}`));

  const entry = children.get(site.app_slug) ?? { restarts: 0 };
  entry.child = child;
  entry.port = port;
  children.set(site.app_slug, entry);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    entry.restarts += 1;
    if (entry.restarts > MAX_RESTARTS) {
      logError(`${prefix} exited ${code ?? signal} and exceeded ${MAX_RESTARTS} restarts — giving up.`);
      return;
    }
    logError(`${prefix} exited (${code ?? signal}); restarting in ${RESTART_DELAY_MS}ms [${entry.restarts}/${MAX_RESTARTS}]`);
    setTimeout(() => startSite(site, domainMap), RESTART_DELAY_MS);
  });

  const domainList = (site.domains ?? []).join(', ') || site.subdomain;
  log(`started ${site.app_slug} on :${port} → ${domainList}`);
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

  if (!sites.length) {
    log('No active sites yet — waiting for one to be provisioned in /admin/apps.');
    setTimeout(() => { void main(); }, 15_000);
    return;
  }

  if (LIST_ONLY) {
    for (const site of sites) {
      log(`${site.app_slug.padEnd(24)} :${site.port}  ${(site.domains ?? []).join(', ') || site.subdomain}`);
    }
    return;
  }

  if (!DEV_MODE && !findStandaloneServer()) {
    logError(`No standalone server found (looked in: ${SERVER_CANDIDATES.join(', ')}). Run "npm run build" first, or pass --dev.`);
    process.exit(1);
  }

  const domainMap = buildDomainMap(sites);
  log(`launching ${sites.length} site(s) in ${DEV_MODE ? 'development' : 'production'} mode`);
  for (const site of sites) startSite(site, domainMap);

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logError(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
