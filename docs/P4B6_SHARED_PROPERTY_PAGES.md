# P4-B6 — Shared Component PropertyPage reconciliation

This checkpoint reuses the mature Shared Component authoring metadata in the
new Template Studio instead of maintaining a second, generic-only editor.

## Registry reuse

- Component instances resolve their Standard type directly or through a
  reusable Component reference.
- `SHARED_COMPONENT_PROPERTY_REGISTRY` now drives grouped text, textarea,
  number, boolean, select and JSON editors in Template Studio.
- JSON properties keep an independent draft and show an inline parse error;
  invalid JSON is never written into the Component instance.
- Properties not covered by the registry remain intact and editable through an
  Additional Props section.

## Full Component library

- Page Panel and Screen region palettes now use `COMPONENT_PALETTE` rather than
  a four-item hard-coded list.
- New instances copy the selected Component's default Props, so Preview starts
  from the same defaults as the mature Studio.
- A registry contract test ensures every palette entry has both a runtime
  renderer and PropertyPage metadata and that palette types remain unique.

## P4 status after this checkpoint

The structured Template Studio now covers Object creation, Screen/Page layout,
Component placement/order/removal, Shared Component properties, Collection
bindings, lifecycle events, Menu/Popup actions, HTML Studio and Draft Preview.
The remaining P4 acceptance gate is browser interaction coverage across the
complete workflow.
