# P4-B5 — Runtime Collection bindings

This checkpoint connects P4-B3's schema-assisted binding editor to executable
Draft Preview behavior and publish validation.

## Shared resolver

- `resolveComponentBindings` resolves an instance's string bindings against the
  current Page lifecycle data and overlays resolved values on authored Props.
- `alias` resolves the complete Collection result.
- `alias.rows` supports the existing whole-row convention used by the baseline
  Template definition.
- `alias.field` projects that field from every row when the Collection result is
  an array.
- Missing runtime paths leave the authored Prop unchanged instead of replacing
  it with `undefined`.

## Preview integration

- Draft Preview stores `LifecycleResult.page.data` after Route or Page changes.
- Page, Screen and Popup Component instances all receive props through the same
  resolver.
- Draft Preview's current no-write Collection adapter still returns empty rows;
  the binding execution path is nevertheless identical for populated adapters.

## Publish validation

- Component bindings must reference a Collection alias loaded by their Page.
- Screen-region Components may reference aliases from Pages assigned to that
  Screen.
- A field segment must be `rows` or an actual field on the referenced
  Collection; stale aliases and fields produce `missing_binding_alias` or
  `missing_binding_field` issues before Preview/Publish.

## Remaining P4 acceptance work

- Browser interaction coverage for the complete create/edit/preview flow
- Mature legacy PropertyPage reconciliation
