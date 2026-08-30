# Form Designer implementation

## Data ownership

- A reusable form template is a private row in `platform_components` with
  `component_type = 'FormComponent'`. The existing owner boundary applies: a
  user sees only their own private components until an explicit copy is added
  to `share_components`.
- A placement on a master page is a row in `platform_pages_components`. It is a
  reference to the live template, not a copied field definition.
- Each placement receives a unique `instance_key` and `instance_name`, so the
  same form may be placed more than once on one page.

## Form definition

The component `definition` contains:

- `fields`: ordered field definitions rendered by `FormComponent`.
- `collectionSet`: zero or more Platform collections. When it is not empty,
  exactly one entry has `role: 'primary'`; other entries are lookups.
- `requestContract`: named inputs expected from the host page, such as
  `currentUser` and `siteOwner`.
- `responseContract`: named outputs exposed to the host page, such as
  `formData` and `submitResult`.
- form presentation and behaviour (`title`, `description`, button labels and
  mode).

Bindings and instance-only overrides live in `platform_pages_components`, so a
Page can connect one form template differently in each placement without
forking the template.

## Runtime resolution

Page Designer, Studio preview, App Page resolution and public runtime hydrate
`platform_pages_components` from the current `platform_components.definition`.
Hydrated nodes are removed again before a Page tree is saved. This prevents a
stale form copy from leaking into `platform_pages.component_tree` or an App
Page override.

On submit, `FormComponent` receives request values as its second callback
argument and emits a response envelope containing `formData`, `submitResult`
and mapped `outputs`. The dynamic page renderer forwards that envelope through
the page action channel using `<instance-id>.response`.

## Designer route

`/form-designer` is available from the root Web tools menu immediately after
Page Designer. The screen provides:

- Form Properties and Collection Set tabs on the left.
- A central live form preview.
- A field palette on the right.
- Selected-field properties at the bottom.
- Save Form and Add to Page actions.

Saving a template increments its version. Because Page placements are live
references, every placement of that formId reflects the updated definition on
the next fetch/render without rewriting the Page.
