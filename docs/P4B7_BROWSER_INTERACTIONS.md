# P4-B7 — Template Studio browser interaction coverage

This checkpoint adds a browser-DOM interaction harness for the main P4 paths
using Vitest, jsdom, Testing Library and user-event.

## Covered interactions

- Create an On Start Up Object through `TemplateStudioClient`, including the
  real request payload and post-save reload path.
- Edit registry-backed Component Props, add a Collection binding and save the
  resulting Component instance definition.
- Assign a Popup to a Screen, create a typed Open Popup menu action and save the
  combined Screen/Page contract.
- Load Draft Preview, run Change Page through `LifecycleRunner`, open the Popup
  overlay and render the target Page Component.

## Defects caught by the interaction test

- Incremental controlled editing of a record key appended characters to stale
  keys. Key renames now commit the complete value on blur.
- Menu Action and Target labels were visually present but not associated with
  their select controls. Both controls now expose accessible names.

## Scope

The tests use production React components, lifecycle code and request shapes;
network responses are deterministic in-memory fixtures. A deployed Chromium
smoke test can be added later for environment wiring, but the core P4 create,
edit and preview interaction paths now run in CI without an external database.
