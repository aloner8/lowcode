# P8 worker, release, and version lifecycle

## Runnable outbox worker

The production image contains `scripts/service-worker.mjs`. Run the same image
with a worker command instead of the web command:

```text
node scripts/service-worker.mjs
```

Configuration is environment-only:

- `CONTROL_PLANE_INTERNAL_URL`: internal HTTP(S) origin of the control plane;
- `SERVICE_WORKER_SECRET`: protected shared secret also configured on the web
  runtime;
- `SERVICE_WORKER_BATCH_SIZE`: 1–100, default 20;
- `SERVICE_WORKER_INTERVAL_MS`: 250–300000, default 5000;
- `SERVICE_WORKER_REQUEST_TIMEOUT_MS`: 1000–120000, default 30000.

`--once` or `SERVICE_WORKER_RUN_ONCE=true` processes one batch for a scheduler.
The continuous mode waits between non-overlapping batches, backs off after
endpoint failures, and exits cleanly on SIGINT/SIGTERM. The secret is sent only
in the Authorization header and is never included in worker logs.

Mail jobs retain the database lease/idempotency behavior documented in
[P8_MAIL_SMTP.md](P8_MAIL_SMTP.md). During deployment, stop the old worker,
wait for its two-minute lease or verify it exited cleanly, then start the new
worker. Do not run incompatible worker generations against the same queue.

## Version contract

`npm run release:verify` proves all of the following before an artifact can be
released:

- the root application pins the exact ShareModule version;
- `SHAREMODULE_VERSION`, package metadata, and build manifest agree;
- platform and ShareModule versions may advance independently;
- `configSchemaVersion` is valid;
- a release tag is exactly `sharemodule-v<package-version>`.

The authenticated system-version endpoint exposes the same build manifest for
deployment diagnostics. Docker images carry OCI source, revision, platform
version, and ShareModule version labels.

## Tag release

`.github/workflows/release.yml` is triggered only by `sharemodule-v*` tags. It
applies migrations to a disposable PostgreSQL service, runs typecheck/lint/tests
and the production build, packs the compiled npm workspace, builds and smoke
tests the runtime image, pushes a versioned GHCR image, records its immutable
digest, and attaches the package plus release manifest to a GitHub Release.

Creating or pushing a tag is an explicit release action. This checkpoint adds
the workflow but does not create a tag, publish a package, push an image, or
deploy a runtime.

## Rollout and rollback

1. Run the release workflow from the exact tag and retain its package,
   release-manifest, image digest, and migration notes.
2. Deploy the digest to staging, then one child App, and compare the authenticated
   version endpoint with the release manifest.
3. Smoke Auth, Files, Mail worker, Google binding policy, and local Media before
   widening the rollout.
4. Roll back by digest and App config revision only while the database schema is
   backward compatible. Migrations use expand/contract; destructive rollback
   requires the separately proven backup/restore procedure.
5. Drain or stop workers before switching incompatible versions. Never delete
   `unknown` mail jobs automatically because delivery may already have occurred.

The real staging/child-App rollout remains deferred by the owner's P7 decision;
local image proof and CI workflow existence do not replace that acceptance gate.
