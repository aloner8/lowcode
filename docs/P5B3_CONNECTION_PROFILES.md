# P5-B3 — Connection Profiles and config policy

This checkpoint introduces a Customer-owned, server-side Connection Profile
registry. A Profile stores connection metadata, policy and opaque SecretRefs;
it never stores credential values or a connection string.

## Data model

Migration `029_create_connection_profiles.sql` adds:

- `connection_profiles`, scoped by `customer_id` with optimistic
  `edit_version`;
- typed `POSTGRES`, `HTTP` and `OBJECT_STORAGE` metadata;
- `secret_refs`, `policy`, readiness/error state and validation timestamps;
- `apps.connection_profile_id` as the server-selected App connection.

The migration is additive and does not rewrite existing Apps.

## API

- `GET /api/connection-profiles?customerId=...`
- `POST /api/connection-profiles`
- `GET /api/connection-profiles/:id`
- `PATCH /api/connection-profiles/:id`
- `POST /api/connection-profiles/:id/validate`
- `GET|PUT /api/apps/:id/connection-profile`

Customer VIEWER/EDITOR and App VIEWER/ADMIN guards are enforced before the
corresponding read or mutation. App binding verifies the Profile and Template
belong to the same Customer and uses the current selector as an optimistic
guard.

## Secret boundary

- Sensitive config keys such as password, token, API key, private key,
  credential and connection string are rejected recursively.
- Profile SecretRefs must use the dedicated
  `env://LOWCODE_CONNECTION_*` namespace. A Customer cannot select unrelated
  process environment variables.
- Browser DTOs contain only secret key, provider and configured status. The
  underlying SecretRef and secret value are never returned.
- Validation checks schema and SecretRef availability without reading or
  returning secret values and without making outbound network connections.

`READY` currently means **configuration-ready**, not that a live remote
connection test succeeded. A later connector-specific health check must record
its own result before claiming external connectivity.

## Runtime policy

The server-only resolver joins App → Template Customer → Connection Profile and
fails closed unless:

- the Profile is `READY`;
- the requesting Module is in `allowedModuleKeys`;
- write access is explicitly enabled for a write operation.

It returns connection metadata and SecretRefs only to server code. Individual
connectors remain responsible for resolving SecretRefs through the approved
secret resolver and for enforcing outbound-host policy.

App service-binding overrides additionally cannot change service/version,
enable a disabled parent, add operations/permissions, or raise the Platform
rate-limit envelope (`138fee5`).

## Verification

- all 29 migrations execute successfully on disposable PostgreSQL 17;
- unit/API tests cover plaintext rejection, namespace isolation, Customer/App
  ownership, optimistic conflicts, browser redaction, readiness and runtime
  module/write enforcement;
- typecheck and targeted lint pass.
