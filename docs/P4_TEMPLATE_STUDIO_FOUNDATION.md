# P4-A — Template Studio usable path

This checkpoint connects the new Customer/Template/Object model to a dedicated
Studio route without replacing the existing legacy Platform Studio.

Open a Template at `/templates/:templateId/studio`.

## Available now

- The left navigation follows the required order: On Start Up, Module Setting,
  Site Map View, Collection Set, Screens, Pages and Components.
- The header searches Objects across the active section and changes the
  Template's Public flag with optimistic concurrency.
- Guided quick-create produces valid defaults for Startup, Module, Route,
  Collection, Screen, Page and Component Objects without requiring JSON edits.
- Site Map View is composed from stored Route references and the authoritative
  `template_screen_pages` relationships.
- A new Screen is attached to an existing default Page transactionally. A Page
  created later is appended to the first Screen relation set.
- Standard components can be dragged into a real Page Panel. The placement is
  saved as a `COMPONENT_INSTANCE`, not as transient canvas state.
- Auto Form creates a reusable Form component and instance from Collection
  metadata, and adds the Collection load to its target Page.
- Responsive widths are shown for Desktop, Tablet and Mobile on every Panel.
- Rename, Public and Publish operations persist through the P1/P3 APIs. Publish
  displays reference validation failures returned by the server.

## Concurrency and ownership

`PUT /api/templates/:id/screen-pages` replaces one Screen's Page set in one
transaction, requires exactly one default, checks every Object belongs to the
same Template, rechecks the database role, and rejects a stale Template
`edit_version` with `EDIT_CONFLICT`.

## Deliberate boundary

This is P4-A, not the entire P4 acceptance gate. The next slice should add full
PropertyPage editors for each Object type, multi-Screen relationship controls,
Panel resize/reorder, HTML Studio launch, lifecycle Preview through the runtime
renderer, and browser interaction tests. The legacy Studio remains available
while its mature editors are adapted instead of copied.
