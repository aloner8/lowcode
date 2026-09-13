# P4-B3 — Component order, removal and schema-assisted bindings

This checkpoint extends the P4 Template Studio editing path without changing
the published-runtime contract.

## Placement editing

- Page Panel and Screen region instances are displayed in deterministic
  `loadOrder` order.
- Users can select, move up/down and remove an instance directly from its
  placement surface.
- Reordering sends the complete sibling list with every expected edit version.
  The server locks the Template and all Component instances, rejects stale or
  incomplete lists, and updates all `loadOrder` values in one transaction.
- Screen region ordering and deletion keep the authoritative
  `regions[].componentInstanceIds` reference list synchronized.
- Removal is intentionally limited to `COMPONENT_INSTANCE` objects in this
  slice; reusable Component dependency deletion remains a later guarded flow.

## Binding editor

- Bindings remain string paths in the existing Template contract.
- For a Page Panel instance, the editor discovers the owning Page's Collection
  loads and suggests each alias plus fields from the referenced Collection.
- For a Screen region instance, suggestions combine the Collection schemas of
  Pages assigned to that Screen.
- Custom paths remain supported for runtime values that do not come directly
  from a Collection field.

## Verification

- Helper tests cover placement identity, stable ordering and invalid placement
  rejection.
- API tests cover atomic Page Panel ordering and Screen-region reference cleanup
  during removal.
- Full typecheck, lint and test suites remain the release gate for the slice.

## Remaining P4 acceptance work

- Browser interaction coverage for the complete create/edit/preview path
- Menu/Popup editors and runtime actions
- Runtime resolution and validation of the schema-assisted binding paths
- Reconciliation of mature legacy PropertyPage behavior not yet exposed through
  the Template registry
