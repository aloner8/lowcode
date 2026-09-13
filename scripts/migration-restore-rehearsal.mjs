#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Never accepts a database URL, existing container, volume or production dump.
const name = `lowcode-p7-rehearsal-${randomUUID()}`;
const image = 'postgres:17';
const docker = (args, input) => execFileSync('docker', args, {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 16 * 1024 * 1024,
});
const sql = (database, input) => docker(['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], input);
const fingerprint = `
CREATE OR REPLACE FUNCTION pg_temp.inventory() RETURNS TABLE(table_name text, row_count bigint, checksum text) LANGUAGE plpgsql AS $$
DECLARE item record;
BEGIN
 FOR item IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, tablename LOOP
  RETURN QUERY EXECUTE format('SELECT %L::text, count(*), md5(coalesce(string_agg(payload, E''\\n'' ORDER BY payload), '''')) FROM (SELECT row_to_json(t)::text AS payload FROM %I.%I t) data', item.schemaname || '.' || item.tablename, item.schemaname, item.tablename);
 END LOOP;
END $$;
SELECT coalesce(json_agg(i ORDER BY table_name), '[]'::json) FROM pg_temp.inventory() i;
`;
const sequenceFingerprint = `
CREATE OR REPLACE FUNCTION pg_temp.sequence_inventory() RETURNS TABLE(sequence_name text, last_value bigint, is_called boolean, settings jsonb) LANGUAGE plpgsql AS $$
DECLARE item record;
BEGIN
 FOR item IN SELECT n.nspname, c.relname, s.seqstart, s.seqincrement, s.seqmax, s.seqmin, s.seqcache, s.seqcycle
   FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY n.nspname, c.relname LOOP
  RETURN QUERY EXECUTE format('SELECT %L::text, last_value, is_called, %L::jsonb FROM %I.%I',
    item.nspname || '.' || item.relname,
    jsonb_build_object('start',item.seqstart,'increment',item.seqincrement,'max',item.seqmax,'min',item.seqmin,'cache',item.seqcache,'cycle',item.seqcycle)::text,
    item.nspname, item.relname);
 END LOOP;
END $$;
SELECT coalesce(json_agg(i ORDER BY sequence_name), '[]'::json) FROM pg_temp.sequence_inventory() i;
`;
let created = false;
let report;
let stage = 'container startup';
const started = Date.now();
try {
  if (process.argv.length !== 2) throw new Error('No external inputs accepted');
  const imageId = docker(['image', 'inspect', image, '--format', '{{.Id}}']).trim();
  docker(['run', '--detach', '--rm', '--pull=never', '--name', name, '--network', 'none', '--memory', '512m', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image, 'postgres', '-c', 'listen_addresses=']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { sql('postgres', 'SELECT 1;'); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error('Postgres not ready');
  sql('postgres', 'CREATE DATABASE rehearsal_source; CREATE DATABASE rehearsal_restored;');
  const directory = fileURLToPath(new URL('../docker/postgres/migrations/', import.meta.url));
  const migrations = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  const migrationDigest = createHash('sha256');
  for (const file of migrations) {
    stage = `migration ${file}`;
    const contents = readFileSync(`${directory}/${file}`, 'utf8');
    migrationDigest.update(file).update('\0').update(contents).update('\0');
    sql('rehearsal_source', contents);
  }
  for (const file of ['p1_template_registry_acceptance.sql', 'p3_template_app_registration.sql']) {
    stage = `acceptance ${file}`;
    sql('rehearsal_source', readFileSync(new URL(`../tests/sql/${file}`, import.meta.url), 'utf8'));
  }
  sql('rehearsal_source', `
    CREATE SCHEMA p7_fixture;
    CREATE TABLE p7_fixture.parents (id integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE p7_fixture.assets (id integer PRIMARY KEY, parent_id integer REFERENCES p7_fixture.parents(id), data bytea NOT NULL);
    INSERT INTO p7_fixture.parents VALUES (1, '{"text":"ทดสอบ restore","style":{"color":"red"},"binding":"contacts.name"}');
    INSERT INTO p7_fixture.assets VALUES (1,1,decode('00ff0180','hex'));
    CREATE TABLE p7_fixture.generated_ids (id bigint GENERATED ALWAYS AS IDENTITY (START WITH 100 INCREMENT BY 7) PRIMARY KEY);
    INSERT INTO p7_fixture.generated_ids DEFAULT VALUES;
    INSERT INTO p7_fixture.generated_ids DEFAULT VALUES;
    DELETE FROM p7_fixture.generated_ids WHERE id = 107;
    CREATE SEQUENCE p7_fixture.unused_ids START WITH 500 INCREMENT BY 3;
  `);
  stage = 'source fingerprint';
  const before = JSON.parse(sql('rehearsal_source', fingerprint));
  const sequencesBefore = JSON.parse(sql('rehearsal_source', sequenceFingerprint));
  stage = 'dump and restore';
  docker(['exec', name, 'pg_dump', '-U', 'postgres', '-d', 'rehearsal_source', '-Fc', '-f', '/tmp/p7.dump']);
  docker(['exec', name, 'pg_restore', '-U', 'postgres', '-d', 'rehearsal_restored', '--exit-on-error', '/tmp/p7.dump']);
  stage = 'restored fingerprint';
  const after = JSON.parse(sql('rehearsal_restored', fingerprint));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Restore data mismatch');
  stage = 'sequence preservation';
  const sequencesAfter = JSON.parse(sql('rehearsal_restored', sequenceFingerprint));
  if (JSON.stringify(sequencesBefore) !== JSON.stringify(sequencesAfter)) throw new Error('Restore sequence mismatch');
  sql('rehearsal_restored', `DO $$ DECLARE generated bigint; unused bigint; BEGIN
    INSERT INTO p7_fixture.generated_ids DEFAULT VALUES RETURNING id INTO generated;
    SELECT nextval('p7_fixture.unused_ids') INTO unused;
    IF generated <> 114 OR unused <> 500 THEN
      RAISE EXCEPTION 'Restored sequence continuation is incorrect';
    END IF;
  END $$;`);
  stage = 'foreign key enforcement';
  sql('rehearsal_restored', `DO $$ BEGIN
    BEGIN
      INSERT INTO p7_fixture.assets VALUES (2,999,decode('01','hex'));
      RAISE EXCEPTION 'Foreign key was not restored';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
  END $$;`);
  report = {
    schemaVersion: 'p7-synthetic-restore-rehearsal.v1', image, imageId,
    migrationCount: migrations.length, migrationDigest: migrationDigest.digest('hex'),
    tablesCompared: before.length, rowsCompared: before.reduce((sum, table) => sum + table.row_count, 0),
    dataMatched: true, foreignKeyVerified: true, acceptanceSqlPassed: ['P1', 'P3'],
    sequencesCompared: sequencesBefore.length, sequenceStateMatched: true, generatedIdContinuationVerified: true,
    elapsedMs: Date.now() - started, readyForApply: false,
    limitations: ['Synthetic isolated database only; not a selected App staging backup.', 'Does not prove filesystem assets, roles, renderer behavior or production recovery time.'],
  };
} catch {
  process.stderr.write(`Synthetic restore rehearsal failed at ${stage}; no production database was accessed.\n`);
  process.exitCode = 1;
} finally {
  if (created) {
    try { docker(['stop', '--time', '5', name]); }
    catch { process.stderr.write(`Temporary rehearsal container cleanup failed: ${name}\n`); process.exitCode = 1; }
  }
}
if (!process.exitCode && report) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
