# P4-B2 — Components, lifecycle events and Draft Preview

This checkpoint closes the next P4 editing slice on top of the P4-A/P4-B1
Template Studio.

## Structured editing

- Component instances expose typed scalar Props and Bindings rows, load order,
  source and placement without requiring JSON editing.
- Reusable Components select Standard or HTML mode. HTML mode opens the
  existing `HtmlStudioShell`; saving returns its versioned document to the same
  Template Object.
- Screen lifecycle steps can be added, assigned to one of the six contract
  phases, reordered and removed. Saving the Screen and its authoritative Page
  relationship is one user action and retains optimistic concurrency checks.
- Standard Components can now be dragged into Header, Left, Content, Right or
  Footer regions. The Studio persists both the `COMPONENT_INSTANCE` placement
  and the Screen region reference.

## Draft Preview

`GET /api/templates/:id/preview` reads a repeatable snapshot of the editable
Object registry, compiles it through the same `compileTemplateDefinition`
contract used by Publish and returns validation issues before rendering. It
never stores a revision and removes `connectionProfileRef` from the browser
payload.

The Preview overlay:

- runs navigation with the production `LifecycleRunner`;
- shows the emitted lifecycle trace in order;
- renders the five Screen regions and responsive Page Panels;
- uses the shared Component registry and HTML runtime renderer;
- supports Desktop, Tablet and Mobile widths and Route switching;
- uses an empty Collection adapter, so Draft Preview cannot accidentally write
  App business data.

## Remaining P4 acceptance work

- Browser interaction tests for the full create/edit/preview path
- richer component reordering/removal and binding schema selection
- Menu/Popup editors and runtime actions
- reconciling the mature legacy PropertyPage features that are not yet exposed
  through the Template registry
