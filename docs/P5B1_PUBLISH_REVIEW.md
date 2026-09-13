# P5-B1 — Publish validation and revision review

This checkpoint makes Template publication an explicit two-step operation.

## Flow

1. `GET /api/templates/:id/publish` reads one repeatable-read snapshot of the
   Template, Objects and Screen/Page relations.
2. The server compiles and validates the Draft with the same compiler used by
   the publish operation.
3. The response reports whether publication is allowed, validation issues, the
   candidate digest and an Object-level diff against the active revision.
4. Studio displays the review and sends the reviewed `expectedEditVersion` only
   after explicit confirmation.
5. `POST /api/templates/:id/publish` locks the Template and rejects a stale
   review with HTTP `409`; a valid Draft becomes or reuses an immutable revision.

## Diff contract

The diff reports `added`, `changed` and `removed` entries for Template content,
Startup, Modules, Routes, Screens, Screen/Page assignments, Pages, reusable and
placed Components, Collections and Popups. Publication-only identity fields are
ignored, and definitions or connection values are never returned in the diff.

## Safety properties

- Review is read-only and never inserts a revision.
- Validation failures remain visible in the review dialog and disable confirm.
- Editing the Draft between review and confirmation cannot silently publish the
  newer content.
- The digest is generated server-side from deterministic compiled content.
- Draft edits still do not affect Apps pinned to earlier immutable revisions.

## Verification

Unit/API/browser-DOM coverage proves deterministic diffs, read-only review,
stale-version rejection, and confirmation with the exact reviewed edit version.
