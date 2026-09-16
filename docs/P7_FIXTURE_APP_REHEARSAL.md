# P7 Self-contained Fixture App Rehearsal

## Decision and scope

On 2026-09-16 the owner approved a small representative legacy App with real
automated tests as the staging substitute for the previously blocked
customer-App snapshot. This closes the P7 implementation/staging gate without
guessing a production database location or credential. It does **not** claim a
production-data migration, production-volume result, or recovery-time SLA.

Run the proof with:

```bash
npm run migration:rehearse:fixture-app
```

The command accepts no arguments, database URLs, existing containers, volumes,
or credentials. It creates a disposable PostgreSQL 17 container, exposes a
random port on `127.0.0.1` only, and removes the container and temporary files
whether the run succeeds or fails.

## Representative App

The fixture uses the real legacy and target tables and includes:

- one owner account and Platform;
- one App and ready domain;
- one Page with style/binding metadata;
- one reusable Component and placed Component instance;
- one Collection definition and published service binding;
- two filesystem assets, including Unicode content;
- one tenant database with a revision snapshot and CRUD data.

The conversion is additive. It creates Customer membership, Template objects,
dependencies, an immutable revision, and an operation journal before switching
the App to the new revision. Legacy Platform/Page/Component/Collection payloads
remain available for rollback.

## Automated acceptance

The rehearsal proves the following in one disposable run:

1. all repository migrations install on a clean PostgreSQL 17 database;
2. the read-only inventory reports unresolved legacy mappings before conversion;
3. conversion resolves all mappings and leaves zero reference violations;
4. legacy Page, Component, Collection, binding, style, and layout payload hashes
   do not change;
5. the runtime resolves the published revision and all Screen/Page/Collection/
   Component references;
6. tenant create/read/update works with Unicode data;
7. the App can switch back to its legacy renderer/config and then cut over again;
8. Core and tenant custom-format dump/restore fingerprints match;
9. filesystem asset manifests match after staging and restore;
10. cleanup removes all resources created by the rehearsal.

`tests/p7FixtureApp.test.ts` separately validates the published definition and
runs it through the real `LifecycleRunner`, including Collection load and
Component preparation.

## Verified result

Verified on 2026-09-16 with local image `postgres:17`:

- 34 migrations applied;
- unresolved mappings: 6 before, 0 after;
- reference violations after conversion: 0;
- 1 Page, 1 Component, 1 Collection, 1 binding, and 2 assets preserved;
- legacy payload, staged assets, restored assets, Core restore, and tenant
  restore fingerprints matched;
- runtime reference resolution, tenant CRUD, rollback, and recutover passed;
- measured final rehearsal time: 7.012 seconds.

## Remaining production-only evidence

Before migrating an existing customer production App, repeat the inventory and
backup procedure against an authorized quiescent snapshot and measure volume,
RTO/RPO, roles/ownership, DNS/proxy cutover, and external providers. These are
deployment acceptance items, not blockers for the P7 implementation/staging
fixture approved above.
