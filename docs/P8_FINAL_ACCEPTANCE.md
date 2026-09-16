# P8 final implementation acceptance

Date: 16 September 2026

Branch: `dev`

ShareModule: `0.4.0`

P8 implementation is complete for the locally provable scope. It is not a
production-rollout acceptance: the owner explicitly deferred the P7 real
child-App/staging gate, and protected external provider test infrastructure was
not available. Those facts remain visible rather than being replaced by mocks.

## Implemented checkpoints

| Area | Result | Primary checkpoint |
|---|---|---|
| Mail | SMTP/STARTTLS/TLS, CC, immutable attachment/template snapshots, preview, durable leases/recovery, Studio configuration | `1a18d60`, `dc90838` |
| Auth | local registration, Google/LINE/Facebook/Entra OAuth with PKCE/state, LDAPS/AD DS group mapping, identity links, session revocation | `b414efc` |
| Google/Media | Maps/Calendar/Drive/Forms/Vision/Gemini adapters, Studio components, schema bounds, local QR and Sharp resize | `dc16c70` |
| Worker/Release | runnable outbox worker, version contract, OCI labels, tag-driven package/GHCR/GitHub Release workflow, rollback runbook | `3ecab9e` |

## Acceptance evidence

- `npm test`: 83 files passed, 1 file conditionally skipped; 403 tests passed,
  2 PostgreSQL integration tests skipped because their opt-in database URLs were
  not supplied (`APP_PROVISION_TEST_DATABASE_URL` and
  `COLLECTION_PROCEDURE_TEST_DATABASE_URL`).
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 83 repository-baseline warnings; targeted P8 files
  add no lint error.
- `npm run build`: passed; the known Turbopack dynamic tenant-storage trace
  warning remains.
- `npm run release:verify`: platform/package/export/build-manifest/config-schema
  versions and git SHA passed.
- ShareModule package dry-run: `@matchanu/sharemodule@0.4.0` compiled artifact
  contents verified.
- Docker image built from commit `3ecab9e`, then passed compiled package, HTTP
  auth/origin, and runnable worker smokes. OCI labels reported platform `0.1.0`,
  ShareModule `0.4.0`, and the exact commit SHA. The disposable local image was
  removed after verification.
- Mail previously passed clean migrations `001–034` on PostgreSQL 17 and a real
  local SMTP socket integration. Google/Media and release add no Core DB schema.
- npm audit baseline remains 39 findings (37 moderate, 2 high); no automated
  dependency rewrite was applied.

## Explicitly deferred evidence

The following are not represented as passed:

1. P7 inventory/migration/restore and workflow testing with a real child App or
   staging snapshot.
2. External SMTP account delivery and provider-side delivery evidence.
3. Real Google/LINE/Facebook/Entra tenant callbacks and a real LDAP/AD directory.
4. Real Google Cloud consent, revoked-token, pagination/quota, Calendar, Drive,
   Forms, Vision, Maps restriction, and Gemini test-account acceptance.
5. Creating/pushing a release tag, publishing package/GHCR artifacts, deploying
   the digest, or exercising rollback in staging.

## Closure rule

P8 code implementation is closed at this checkpoint. Production readiness is
still gated by the five deferred evidence groups above, especially the owner's
deferred P7 real-App gate. Resume from the runbooks without altering the
implemented contracts: supply protected test infrastructure, run the external
acceptance suites, tag the exact package version, deploy by digest, then execute
the staged rollout/rollback checklist.
