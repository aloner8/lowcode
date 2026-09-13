# P4-B4 — Menu, Popup and Preview actions

This checkpoint makes Screen navigation and Popup behavior editable and
executable inside the Template Studio Draft Preview.

## Authoring

- The existing seven-section Studio navigation remains unchanged. Popup
  objects live with Screens instead of adding another top-level section.
- Users can create a Screen or a Popup without editing JSON.
- Popup properties select the Page rendered inside the overlay.
- Screen properties assign Popups and edit ordered menu items with one of the
  typed contract actions: Change Page, Navigate Route or Open Popup.
- Action targets are selected from authoritative Screen/Page, Route and Popup
  objects.

## Runtime preview

- Draft Preview renders the Screen menu and dispatches each typed action.
- Change Page runs through the same `LifecycleRunner.changePage` path used by
  route navigation.
- Navigate Route runs a fresh route lifecycle and clears an open Popup.
- Open Popup renders the Popup Page's responsive Panels and Component
  instances in an overlay without mutating draft state.

## Validation

- Publish/Preview rejects a menu action that targets a Popup which has not been
  assigned to the same Screen (`popup_not_in_screen`).
- Existing validation still rejects missing Page, Route and Popup references.

## Remaining P4 acceptance work

- Browser interaction coverage for the complete create/edit/preview flow
- Runtime resolution and validation of Collection binding paths
- Mature legacy PropertyPage reconciliation
