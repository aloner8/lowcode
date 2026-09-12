# P3 — Template revision to isolated App databases

This checkpoint implements and proves the smallest real architecture slice in
`ImplementPlan.MD`: one immutable Template revision can provision multiple Apps,
while every App stores business records in its own PostgreSQL database.

## Implemented path

1. `POST /api/templates/:id/publish` compiles the editable Object registry,
   validates references and database identifiers, calculates a stable SHA-256
   revision digest, and stores an immutable revision.
2. `POST /api/templates/:id/apps` requires an `Idempotency-Key`, registers the
   App under the Template owner, enforces ownership/quota/name constraints, and
   records a resumable provisioning operation.
3. The provisioner explicitly creates the App database, bootstraps its `sys`
   schema, creates Collection tables additively, and records the applied
   Template revision. Normal read paths only open an existing database and can
   never create one as a side effect.
4. `GET /api/runtime/:slug/form` reads the App's pinned immutable definition
   from DB_main. Server-side connection profile references are removed before
   the response crosses the browser boundary.
5. `/api/runtime/:slug/db/:collectionId` provides public list/create operations;
   `/api/runtime/:slug/db/:collectionId/:recordId` provides read/update. The
   server resolves the App ID, database name, Collection ID, physical table and
   published access flags. Callers never submit a database or table name.

## State and retry rules

- `apps.desired_state` and `apps.observed_state` are separate.
- `app_operations` stores the operation key, state, checkpoint, result and
  error. A retry using the same Customer/key reuses the same App and operation.
- Database provisioning and schema application are idempotent. Completed jobs
  return the recorded App instead of creating resources again.
- Pool disposal is explicit (`closeTenantDbPool`) so a stopped App does not
  retain connections indefinitely.

## Evidence

- A clean PostgreSQL 17 instance applies migrations `001` through `028`.
- SQL acceptance proves cross-Customer denial, quota enforcement, immutable
  revision selection, and idempotent App registration.
- Integration coverage provisions two databases from the same definition,
  inserts different records, updates App A, closes/reopens its connection pool,
  and confirms both persistence and isolation before removing the test DBs.
- API tests prove unknown Collection IDs are not treated as table names.

## Deliberate boundary

This completes the P3 data-path foundation. A browser renderer that consumes
`api/form`, process/container start-stop, health checks, and proxy/DNS changes
remain later work. No runtime or proxy configuration is changed in this phase.
