# P4-B1 — Property and layout editing

This checkpoint replaces the P4-A read-only property summary with persisted,
structured editors. It deliberately remains an additive path beside the legacy
Studio.

## Available now

- Startup CSS, Module key/enabled state, Route path/Screen/default state and
  Collection table/public-access policy can be edited without JSON.
- Collection fields support add/remove, label, safe column key, data type,
  required state and a single primary-key selection.
- A Screen can select multiple Pages, choose exactly one default Page and
  reorder the Page list. Saving updates both the authoritative
  `template_screen_pages` rows and the Screen's `defaultPageId`.
- Page CSS and Panels can be edited. Panels support add/remove, ordering and
  clamped Desktop/Tablet/Mobile widths from 1–12 columns.
- All Object saves retain optimistic object versions; Screen/Page relation
  replacement also retains the Template-level optimistic concurrency guard.
- Pure editing helpers have unit coverage for ordering, responsive-width
  normalization, de-duplication and default-Page enforcement.

## Remaining P4-B work

- Structured editors for component props/bindings and Screen event steps
- Screen-region component placement and richer drag/reorder interaction
- HTML Studio launch/adaptation
- Lifecycle Preview wired to the new immutable runtime definition
- Browser interaction coverage for the complete create/edit/preview workflow
