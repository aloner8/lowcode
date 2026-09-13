# P5-B2 — Isolated App revision updates

`POST /api/apps/:id/revision` updates one Template-managed App to a selected
immutable revision. The caller must hold `ADMIN` access on that App and provide
an `Idempotency-Key`.

## Operation sequence

1. Lock the target App and verify the requested revision belongs to its
   Template.
2. Reuse an identical operation key or reject a key already used for different
   work.
3. Reject overlapping pending/running App operations.
4. Persist an `UPDATE_REVISION` operation before touching the tenant database.
5. Compare source and target compatibility.
6. Store the target revision snapshot in the target App database.
7. Atomically switch that App's `template_revision_id` and complete the
   operation, guarded by the source revision ID.

App rows other than the requested `appId` are never updated. Draft publication
and App activation remain separate operations, so publishing a Template does
not move any App automatically.

## Current compatibility gate

This checkpoint supports layout, Page, Screen, Component, menu, Popup and other
runtime-definition changes when the Template schema version and Collection
definitions remain compatible. It deliberately rejects:

- a different Template definition schema version;
- any Collection schema change.

The rejection is recorded on the operation with a stable error code while the
App stays pinned to its active revision. Additive Collection migration planning
is the next database-focused extension; destructive schema changes must remain
an explicit migration rather than happening during a normal revision switch.

## Verification

Tests cover durable registration, exact-App atomic activation, Site ADMIN
authorization, idempotency inputs and rejection of unsupported Collection
changes without opening the tenant database.
