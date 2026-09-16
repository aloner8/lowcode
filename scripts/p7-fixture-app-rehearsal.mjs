#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { createMigrationInventory } from './migration-inventory.mjs';
import { inventoryAssets } from './migration-assets.mjs';
import { compareAssetInventories } from './migration-assets-compare.mjs';

const { Client } = pg;

export const P7_FIXTURE_IDS = Object.freeze({
  user: '00000000-0000-4000-8000-000000000701',
  platform: '00000000-0000-4000-8000-000000000702',
  page: '00000000-0000-4000-8000-000000000703',
  component: '00000000-0000-4000-8000-000000000704',
  collection: '00000000-0000-4000-8000-000000000705',
  instance: '00000000-0000-4000-8000-000000000706',
  app: '00000000-0000-4000-8000-000000000707',
  binding: '00000000-0000-4000-8000-000000000708',
  customer: '00000000-0000-4000-8000-000000000711',
  template: '00000000-0000-4000-8000-000000000712',
  screenObject: '00000000-0000-4000-8000-000000000713',
  pageObject: '00000000-0000-4000-8000-000000000714',
  componentObject: '00000000-0000-4000-8000-000000000715',
  collectionObject: '00000000-0000-4000-8000-000000000716',
  instanceObject: '00000000-0000-4000-8000-000000000717',
  revision: '00000000-0000-4000-8000-000000000718',
  operation: '00000000-0000-4000-8000-000000000719',
});

export function createP7FixtureDefinition(revision) {
  const ids = P7_FIXTURE_IDS;
  return {
    schemaVersion: '1.0.0',
    template: {
      id: ids.template,
      customerId: ids.customer,
      name: 'P7 Fixture Contacts',
      status: 'published',
      editVersion: 1,
      revision,
    },
    startup: {
      mainCss: ':root { --fixture-primary: #0c58a9; }',
      browserActions: [],
    },
    modules: [],
    routes: [{ id: 'route.home', path: '/', screenId: 'screen.main', isDefault: true }],
    screens: [{
      id: 'screen.main',
      name: 'Fixture screen',
      defaultPageId: 'page.contacts',
      regions: ['header', 'left', 'content', 'right', 'footer'].map((key) => ({ key, componentInstanceIds: [] })),
      menu: [{ id: 'menu.contacts', label: 'Contacts', action: { type: 'change_page', pageId: 'page.contacts' } }],
      popupIds: [], eventSteps: [], css: '',
    }],
    screenPages: [{ screenId: 'screen.main', pageId: 'page.contacts', sortOrder: 0 }],
    pages: [{
      id: 'page.contacts', name: 'Contacts',
      panels: [{ id: 'panel.content', name: 'Content', order: 0, responsive: { desktop: 12, tablet: 12, mobile: 12 } }],
      collections: [{ collectionId: 'collection.contacts', loadOrder: 0, alias: 'contacts' }],
      css: '',
    }],
    components: [{
      id: 'hero-card', name: 'Contact card', componentType: 'standard', version: 1,
      definition: { type: 'CardComponent', props: { title: 'รายชื่อผู้ติดต่อ' } },
    }],
    componentInstances: [{
      id: 'instance.contacts', placement: 'page_panel', pageId: 'page.contacts', panelId: 'panel.content',
      loadOrder: 0, source: 'reusable', componentId: 'hero-card',
      props: { title: 'รายชื่อผู้ติดต่อ' }, bindings: { rows: 'contacts.rows' },
    }],
    collections: [{
      id: 'collection.contacts', name: 'Contacts', tableName: 'contacts',
      access: { publicRead: true, publicCreate: true, publicUpdate: true },
      fields: [
        { id: 'id', name: 'ID', type: 'integer', required: true, primaryKey: true },
        { id: 'name', name: 'Name', type: 'string', required: true },
        { id: 'email', name: 'Email', type: 'string', required: true },
      ],
    }],
    popups: [],
  };
}

const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const connect = async (port, database) => {
  const client = new Client({ host: '127.0.0.1', port, user: 'postgres', database });
  client.on('error', () => undefined);
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
};

const fingerprintDatabase = async (client) => {
  const tables = await client.query(`SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, tablename`);
  const result = [];
  for (const row of tables.rows) {
    const target = `${quote(row.schemaname)}.${quote(row.tablename)}`;
    const value = await client.query(`SELECT count(*)::int AS count,
      md5(coalesce(string_agg(row_hash, '' ORDER BY row_hash), '')) AS checksum
      FROM (SELECT md5(row_to_json(item)::text) AS row_hash FROM ${target} item) rows`);
    result.push({ table: `${row.schemaname}.${row.tablename}`, ...value.rows[0] });
  }
  return result;
};

const legacyPayloadFingerprint = async (client) => {
  const result = await client.query(`SELECT md5(jsonb_build_object(
    'platform', (SELECT jsonb_build_object('theme',master_theme_config,'layout',studio_layout,'pages',studio_pages) FROM public.platforms WHERE id=$1),
    'page', (SELECT jsonb_build_object('tree',component_tree,'config',page_config,'seo',seo) FROM public.platform_pages WHERE id=$2),
    'component', (SELECT jsonb_build_object('definition',definition,'version',version) FROM public.platform_components WHERE id=$3),
    'collection', (SELECT jsonb_build_object('definition',definition,'version',version) FROM public.collection_sets WHERE id=$4),
    'instance', (SELECT jsonb_build_object('props',props_overrides,'request',request_bindings,'response',response_bindings) FROM public.platform_pages_components WHERE id=$5),
    'binding', (SELECT jsonb_build_object('config',config,'policy',policy,'status',status,'revision',revision) FROM public.app_service_bindings WHERE id=$6)
  )::text) AS checksum`, [
    P7_FIXTURE_IDS.platform, P7_FIXTURE_IDS.page, P7_FIXTURE_IDS.component,
    P7_FIXTURE_IDS.collection, P7_FIXTURE_IDS.instance, P7_FIXTURE_IDS.binding,
  ]);
  return result.rows[0].checksum;
};

const seedLegacyApp = async (client) => {
  const ids = P7_FIXTURE_IDS;
  await client.query(`
    DELETE FROM public.app_operations;
    DELETE FROM public.apps;
    DELETE FROM public.templates;
    DELETE FROM public.customers;
    DELETE FROM public.platforms;
    DELETE FROM public.platform_users;
  `);
  await client.query(`INSERT INTO public.platform_users
    (id,username,email,full_name,password_hash,global_role,is_active)
    VALUES ($1,'p7-fixture-owner','p7-fixture@example.test','P7 Fixture Owner',crypt(gen_random_uuid()::text,gen_salt('bf')),'GOD',TRUE)`, [ids.user]);
  await client.query(`INSERT INTO public.platforms
    (id,platform_slug,platform_name,description,master_theme_config,studio_layout,studio_pages,studio_initialized,is_published,runtime_owner_user_id)
    VALUES ($1,'p7-fixture-platform','P7 Fixture Platform','Disposable staging fixture',
      '{"preset":"modern-indigo","primaryColor":"#0c58a9"}',
      '[{"id":"legacy-layout","region":"content"}]',
      '[{"id":"contacts","title":"Contacts","isDefaultPage":true}]',TRUE,TRUE,$2)`, [ids.platform, ids.user]);
  await client.query(`INSERT INTO public.platform_memberships (user_id,platform_id,platform_role,granted_by)
    VALUES ($1,$2,'ADMIN',$1)`, [ids.user, ids.platform]);
  await client.query(`INSERT INTO public.platform_pages
    (id,platform_id,page_slug,title,access_level,is_entry_page,component_tree,page_config,seo)
    VALUES ($1,$2,'contacts','Contacts','PUBLIC',TRUE,
      '[{"id":"legacy-contact-card","type":"CardComponent","props":{"title":"รายชื่อผู้ติดต่อ"}}]',
      '{"id":"contacts","routePath":"/","binding":"contacts.rows","style":{"padding":"1rem"}}',
      '{"title":"Contacts","description":"P7 fixture","keywords":[],"ogImage":null,"noindex":false,"changeFrequency":"weekly","priority":0.5}')`, [ids.page, ids.platform]);
  await client.query(`INSERT INTO public.platform_components
    (id,platform_id,owner_user_id,component_key,component_name,component_type,definition,version)
    VALUES ($1,$2,$3,'hero-card','Contact card','standard','{"type":"CardComponent","props":{"title":"รายชื่อผู้ติดต่อ"}}',1)`,
    [ids.component, ids.platform, ids.user]);
  await client.query(`INSERT INTO public.collection_sets
    (id,platform_id,owner_user_id,collection_key,collection_name,definition,version)
    VALUES ($1,$2,$3,'collection.contacts','Contacts',
      '{"id":"collection.contacts","tableName":"contacts","fields":[{"id":"id","type":"integer"},{"id":"name","type":"string"},{"id":"email","type":"string"}]}',1)`,
    [ids.collection, ids.platform, ids.user]);
  await client.query(`INSERT INTO public.platform_pages_components
    (id,platform_page_id,platform_component_id,instance_key,instance_name,layout_region,sort_order,props_overrides,request_bindings,response_bindings)
    VALUES ($1,$2,$3,'instance.contacts','Contacts table','content',0,
      '{"title":"รายชื่อผู้ติดต่อ"}','{}','{"rows":"contacts.rows"}')`,
    [ids.instance, ids.page, ids.component]);
  await client.query(`INSERT INTO public.apps
    (id,platform_id,owner_user_id,app_slug,app_name,port,subdomain,tenant_db_name,theme_config,tenant_overrides,is_active,desired_state,observed_state)
    VALUES ($1,$2,$3,'p7-fixture-app','P7 Fixture App',33991,'p7-fixture.localhost','app_db_p7_fixture',
      '{"preset":"modern-indigo","primaryColor":"#0c58a9"}',
      '{"disabledFeatures":[],"themeOverrides":{},"componentPropsOverrides":{}}',TRUE,'STOPPED','STOPPED')`,
    [ids.app, ids.platform, ids.user]);
  await client.query(`INSERT INTO public.app_memberships (user_id,app_id,app_role,granted_by)
    VALUES ($1,$2,'ADMIN',$1)`, [ids.user, ids.app]);
  await client.query(`INSERT INTO public.app_domains (app_id,domain,is_primary,is_active,readiness_status)
    VALUES ($1,'p7-fixture.localhost',TRUE,TRUE,'READY')`, [ids.app]);
  await client.query(`INSERT INTO public.service_definitions
    (service_key,version,display_name,kind,definition) VALUES
    ('p7.fixture.data','1.0.0','P7 fixture data','data','{"operations":["list"]}')
    ON CONFLICT (service_key,version) DO UPDATE SET definition=EXCLUDED.definition`);
  await client.query(`INSERT INTO public.app_service_bindings
    (id,binding_key,platform_id,app_id,service_key,service_version,status,config,policy)
    VALUES ($1,'contacts-data',$2,$3,'p7.fixture.data','1.0.0','published','{}','{"allowedOperations":["list"]}')`,
    [ids.binding, ids.platform, ids.app]);
};

const migrateFixtureApp = async (client, definition, revisionDigest) => {
  const ids = P7_FIXTURE_IDS;
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO public.customers
      (id,customer_slug,customer_name,status,created_by) VALUES ($1,'p7-fixture','P7 Fixture Customer','ACTIVE',$2)`, [ids.customer, ids.user]);
    await client.query(`INSERT INTO public.customer_memberships
      (customer_id,user_id,customer_role,granted_by) VALUES ($1,$2,'OWNER',$2)`, [ids.customer, ids.user]);
    await client.query(`INSERT INTO public.templates
      (id,customer_id,template_slug,template_name,description,legacy_platform_id,created_by,updated_by)
      VALUES ($1,$2,'p7-fixture-template','P7 Fixture Template','Converted legacy fixture',$3,$4,$4)`,
    [ids.template, ids.customer, ids.platform, ids.user]);
    const objects = [
      [ids.screenObject, 'SCREEN', 'screen.main', 'Fixture screen', definition.screens[0]],
      [ids.pageObject, 'PAGE', ids.page, 'Contacts', definition.pages[0]],
      [ids.componentObject, 'COMPONENT', 'hero-card', 'Contact card', definition.components[0]],
      [ids.collectionObject, 'COLLECTION', 'collection.contacts', 'Contacts', definition.collections[0]],
      [ids.instanceObject, 'COMPONENT_INSTANCE', 'instance.contacts', 'Contacts instance', definition.componentInstances[0]],
    ];
    for (const [id, type, key, name, objectDefinition] of objects) {
      await client.query(`INSERT INTO public.template_objects
        (id,template_id,object_type,object_key,object_name,definition,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
      [id, ids.template, type, key, name, JSON.stringify(objectDefinition), ids.user]);
    }
    await client.query(`INSERT INTO public.template_screen_pages
      (template_id,screen_object_id,page_object_id,sort_order,is_default) VALUES ($1,$2,$3,0,TRUE)`,
    [ids.template, ids.screenObject, ids.pageObject]);
    await client.query(`INSERT INTO public.template_object_dependencies
      (template_id,source_object_id,target_object_id,dependency_kind,json_path) VALUES
      ($1,$2,$3,'PAGE_COLLECTION','$.collections[0].collectionId'),
      ($1,$4,$5,'INSTANCE_COMPONENT','$.componentId'),
      ($1,$4,$3,'INSTANCE_BINDING','$.bindings.rows')`,
    [ids.template, ids.pageObject, ids.collectionObject, ids.instanceObject, ids.componentObject]);
    await client.query(`INSERT INTO public.template_revisions
      (id,template_id,revision_number,revision_digest,schema_version,source_edit_version,compiled_definition,published_by)
      VALUES ($1,$2,1,$3,'1.0.0',1,$4::jsonb,$5)`,
    [ids.revision, ids.template, revisionDigest, JSON.stringify(definition), ids.user]);
    await client.query(`UPDATE public.templates SET published_revision_id=$2 WHERE id=$1`, [ids.template, ids.revision]);
    await client.query(`UPDATE public.apps SET template_id=$2,template_revision_id=$3,schema_revision=$4 WHERE id=$1`,
    [ids.app, ids.template, ids.revision, revisionDigest]);
    await client.query(`INSERT INTO public.app_operations
      (id,customer_id,app_id,operation_key,operation_type,status,checkpoint,result,requested_by,started_at,finished_at)
      VALUES ($1,$2,$3,'p7-fixture-cutover','UPDATE_REVISION','COMPLETED','CUTOVER_READY',
        jsonb_build_object('previousPlatformId',$4::uuid,'previousTemplateId',NULL,'previousTemplateRevisionId',NULL),$5,NOW(),NOW())`,
    [ids.operation, ids.customer, ids.app, ids.platform, ids.user]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const verifyRuntimeDefinition = async (client, revisionDigest) => {
  const result = await client.query(`SELECT revision.compiled_definition AS definition
    FROM public.apps app JOIN public.template_revisions revision
      ON revision.id=app.template_revision_id AND revision.template_id=app.template_id
    WHERE app.id=$1 AND revision.revision_digest=$2`, [P7_FIXTURE_IDS.app, revisionDigest]);
  if (result.rowCount !== 1) throw new Error('Runtime revision did not resolve');
  const definition = result.rows[0].definition;
  if (definition.routes?.[0]?.screenId !== 'screen.main'
      || definition.screens?.[0]?.defaultPageId !== 'page.contacts'
      || definition.pages?.[0]?.collections?.[0]?.collectionId !== 'collection.contacts'
      || definition.componentInstances?.[0]?.bindings?.rows !== 'contacts.rows') {
    throw new Error('Runtime references were not preserved');
  }
};

const exerciseRollback = async (client, revisionDigest) => {
  const ids = P7_FIXTURE_IDS;
  await client.query('BEGIN');
  await client.query(`UPDATE public.apps SET template_id=NULL,template_revision_id=NULL,schema_revision=NULL WHERE id=$1`, [ids.app]);
  const legacy = await client.query(`SELECT app.platform_id,page.page_config,component.definition
    FROM public.apps app JOIN public.platform_pages page ON page.platform_id=app.platform_id
    JOIN public.platform_components component ON component.platform_id=app.platform_id
    WHERE app.id=$1`, [ids.app]);
  if (legacy.rowCount !== 1 || legacy.rows[0].platform_id !== ids.platform
      || legacy.rows[0].page_config?.binding !== 'contacts.rows'
      || legacy.rows[0].definition?.type !== 'CardComponent') {
    throw new Error('Legacy renderer/config rollback failed');
  }
  await client.query(`UPDATE public.apps SET template_id=$2,template_revision_id=$3,schema_revision=$4 WHERE id=$1`,
    [ids.app, ids.template, ids.revision, revisionDigest]);
  await client.query('COMMIT');
};

export async function runP7FixtureAppRehearsal() {
  if (process.argv.length !== 2) throw new Error('No arguments, database URLs or existing resources are accepted');
  const name = `lowcode-p7-fixture-${randomUUID()}`;
  const image = 'postgres:17';
  const root = await mkdtemp(join(tmpdir(), 'lowcode-p7-fixture-'));
  const legacyAssets = join(root, 'assets-before');
  const stagedAssets = join(root, 'assets-staged');
  const restoredAssets = join(root, 'assets-restored');
  await mkdir(join(legacyAssets, 'images'), { recursive: true });
  await mkdir(join(legacyAssets, 'documents', 'empty'), { recursive: true });
  await writeFile(join(legacyAssets, 'images', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>P7</text></svg>');
  await writeFile(join(legacyAssets, 'documents', 'readme.txt'), 'P7 fixture asset\nภาษาไทย\n');
  let created = false;
  let core; let tenant; let restoredCore; let restoredTenant;
  let stage = 'container startup';
  const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  const started = Date.now();
  try {
    const imageId = docker(['image', 'inspect', image, '--format', '{{.Id}}']).trim();
    docker(['run','--detach','--pull=never','--name',name,'--network','bridge','--memory','768m','--cpus','1',
      '--tmpfs','/var/lib/postgresql/data:rw','--publish','127.0.0.1::5432',
      '-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
    created = true;
    const mapped = docker(['port',name,'5432/tcp']).trim();
    const port = Number(mapped.slice(mapped.lastIndexOf(':') + 1));
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Docker did not allocate a loopback PostgreSQL port');
    let admin;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { admin = await connect(port, 'postgres'); break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    if (!admin) {
      const logs = docker(['logs', name]).trim().slice(-4000);
      throw new Error(`Disposable PostgreSQL did not become ready: ${logs}`);
    }
    stage = 'database creation';
    await admin.query('CREATE DATABASE fixture_core');
    await admin.query('CREATE DATABASE fixture_tenant');
    await admin.query('CREATE DATABASE fixture_core_restored');
    await admin.query('CREATE DATABASE fixture_tenant_restored');
    await admin.end();
    core = await connect(port, 'fixture_core');
    stage = 'repository migrations';
    const migrationDirectory = fileURLToPath(new URL('../docker/postgres/migrations/', import.meta.url));
    const migrations = readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
    const migrationDigest = createHash('sha256');
    for (const file of migrations) {
      const sql = readFileSync(join(migrationDirectory, file), 'utf8');
      migrationDigest.update(file).update('\0').update(sql).update('\0');
      await core.query(sql);
    }
    stage = 'legacy App seed';
    await seedLegacyApp(core);
    stage = 'pre-migration inventory';
    const legacyPayloadBefore = await legacyPayloadFingerprint(core);
    const inventoryBefore = await createMigrationInventory(core, new Date('2026-09-16T00:00:00.000Z'));
    const assetsBefore = await inventoryAssets(legacyAssets);
    await cp(legacyAssets, stagedAssets, { recursive: true, preserveTimestamps: true });
    const assetsStaged = await inventoryAssets(stagedAssets);
    const assetStageComparison = compareAssetInventories(assetsBefore, assetsStaged);
    if (!assetStageComparison.assetsUnchanged) throw new Error('Staged assets changed');
    const definitionSeed = createP7FixtureDefinition('0'.repeat(64));
    const revisionDigest = createHash('sha256').update(JSON.stringify(definitionSeed)).digest('hex');
    const definition = createP7FixtureDefinition(revisionDigest);
    stage = 'legacy-to-template conversion';
    await migrateFixtureApp(core, definition, revisionDigest);
    stage = 'post-migration inventory';
    const inventoryAfter = await createMigrationInventory(core, new Date('2026-09-16T00:01:00.000Z'));
    if (inventoryAfter.summary.unresolvedMappings !== 0 || inventoryAfter.summary.referenceViolations !== 0) {
      throw new Error('Post-migration inventory is not clean');
    }
    const legacyPayloadAfter = await legacyPayloadFingerprint(core);
    if (legacyPayloadBefore !== legacyPayloadAfter) throw new Error('Legacy payload changed during additive migration');
    await verifyRuntimeDefinition(core, revisionDigest);
    stage = 'tenant schema and CRUD';
    tenant = await connect(port, 'fixture_tenant');
    await tenant.query('CREATE SCHEMA sys');
    await tenant.query(`CREATE TABLE sys.structure_revisions
      (revision char(64) PRIMARY KEY, definition jsonb NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    await tenant.query(`CREATE TABLE public.contacts
      (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,name varchar(500) NOT NULL,email varchar(500) NOT NULL,
       created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`);
    await tenant.query('INSERT INTO sys.structure_revisions(revision,definition) VALUES($1,$2::jsonb)', [revisionDigest, JSON.stringify(definition)]);
    await tenant.query(`INSERT INTO public.contacts(name,email) VALUES ('สมชาย ตัวอย่าง','somchai@example.test')`);
    await tenant.query(`UPDATE public.contacts SET name='สมชาย หลังย้าย',updated_at=now() WHERE email='somchai@example.test'`);
    const contact = await tenant.query(`SELECT name,email FROM public.contacts`);
    if (contact.rows[0]?.name !== 'สมชาย หลังย้าย') throw new Error('Tenant CRUD verification failed');
    stage = 'renderer/config rollback and recutover';
    await exerciseRollback(core, revisionDigest);
    await verifyRuntimeDefinition(core, revisionDigest);
    const coreBeforeRestore = await fingerprintDatabase(core);
    const tenantBeforeRestore = await fingerprintDatabase(tenant);
    stage = 'database dump and restore';
    docker(['exec',name,'pg_dump','-U','postgres','-d','fixture_core','-Fc','-f','/tmp/p7-core.dump']);
    docker(['exec',name,'pg_dump','-U','postgres','-d','fixture_tenant','-Fc','-f','/tmp/p7-tenant.dump']);
    docker(['exec',name,'pg_restore','-U','postgres','-d','fixture_core_restored','--exit-on-error','/tmp/p7-core.dump']);
    docker(['exec',name,'pg_restore','-U','postgres','-d','fixture_tenant_restored','--exit-on-error','/tmp/p7-tenant.dump']);
    restoredCore = await connect(port, 'fixture_core_restored');
    restoredTenant = await connect(port, 'fixture_tenant_restored');
    if (JSON.stringify(coreBeforeRestore) !== JSON.stringify(await fingerprintDatabase(restoredCore))) throw new Error('Core restore fingerprint mismatch');
    if (JSON.stringify(tenantBeforeRestore) !== JSON.stringify(await fingerprintDatabase(restoredTenant))) throw new Error('Tenant restore fingerprint mismatch');
    stage = 'asset restore comparison';
    await cp(legacyAssets, restoredAssets, { recursive: true, preserveTimestamps: true });
    const assetRestoreComparison = compareAssetInventories(assetsBefore, await inventoryAssets(restoredAssets));
    if (!assetRestoreComparison.assetsUnchanged) throw new Error('Asset restore fingerprint mismatch');
    await verifyRuntimeDefinition(restoredCore, revisionDigest);
    const restoredContact = await restoredTenant.query(`SELECT name,email FROM public.contacts`);
    if (restoredContact.rows[0]?.name !== 'สมชาย หลังย้าย') throw new Error('Restored tenant data mismatch');
    stage = 'report';
    return {
      schemaVersion: 'p7-fixture-app-rehearsal.v1',
      proof: 'SELF_CONTAINED_STAGING_FIXTURE', image, imageId,
      migrationCount: migrations.length, migrationDigest: migrationDigest.digest('hex'),
      fixture: { legacyApp: 'p7-fixture-app', pages: 1, components: 1, collections: 1, bindings: 1, assets: assetsBefore.fileCount },
      inventory: {
        beforeUnresolvedMappings: inventoryBefore.summary.unresolvedMappings,
        afterUnresolvedMappings: inventoryAfter.summary.unresolvedMappings,
        afterReferenceViolations: inventoryAfter.summary.referenceViolations,
      },
      preservation: {
        legacyPayloadChecksumMatched: true, assetsMatchedAfterStage: true,
        coreRestoreMatched: true, tenantRestoreMatched: true, assetsMatchedAfterRestore: true,
      },
      runtime: { revisionResolved: true, referencesResolved: true, tenantCrudPassed: true, legacyRollbackPassed: true, recutoverPassed: true },
      cleanup: { disposableContainer: true, externalInputsAccepted: false },
      elapsedMs: Date.now() - started,
      stagingProofPassed: true,
      productionDataProof: false,
      limitations: [
        'Uses a representative self-contained legacy App fixture, not a copy of production customer data.',
        'Does not prove production volume, external provider credentials, DNS/proxy cutover or recovery time objectives.',
      ],
    };
  } catch (error) {
    throw new Error(`${stage}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    await Promise.allSettled([core?.end(), tenant?.end(), restoredCore?.end(), restoredTenant?.end()].filter(Boolean));
    if (created) {
      try { docker(['rm','--force',name]); }
      catch { process.stderr.write(`Temporary fixture container cleanup failed: ${name}\n`); }
    }
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runP7FixtureAppRehearsal()
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`[p7-fixture-app] ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
