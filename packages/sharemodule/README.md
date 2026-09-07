# @matchanu/sharemodule

Shared implementation used by the platform and site runtimes. Version 0.1.0
extracts the existing catalog, validation, errors and file UI into a compiled
workspace package. It adds a typed client, automatic selection of a sole service
binding, a simple file picker, and a local account login component.

```tsx
import { FileManager, Login, ShareModuleProvider } from '@matchanu/sharemodule/react';

<ShareModuleProvider baseUrl="/api/runtime/town/modules">
  <Login afterLogin="/dashboard" />
  <FileManager currentPath="/uploads/documents" multiple onSelect={setFiles} />
</ShareModuleProvider>
```

The platform shell supplies `StorageScopeProvider` once for the existing file
API. That API currently requires a platform/site-management session; tenant
end-user file access and the new storage policy are not implemented by this
extraction. The file picker returns existing `FileManagerAsset` objects, whose
IDs are still paths, not the future immutable FileRef IDs.

```ts
import { createModules } from '@matchanu/sharemodule/client';
const modules = createModules({ baseUrl: '/api/runtime/town/modules' });
await modules.mail.send({ to: 'user@example.com', template: 'welcome', data: { name: 'Somchai' } });
```

Inside React, `useModules()` also supplies `await modules.files.pick({ currentPath,
multiple: true })`. Mount `ShareModuleProvider` inside the application's
`StorageScopeProvider` once. Cancellation resolves to `null` for a single file
or `[]` for multiple files, including when the provider unmounts.

Mail uses an already configured legacy HTTP mail binding/outbox. SMTP, CC,
attachments, social/directory authentication, registration and Google adapters
are subsequent work, not advertised as available in this release. Multiple
bindings require `snapshot.moduleDefaults[module]` to select a default;
disabled or missing bindings fail explicitly. The administrator realm continues
using its existing login rather than accepting tenant credentials.

Build with `npm run build:modules` from the repository root. Exports resolve to
compiled `dist` files; frontend entry points do not import server adapters.
`npm run build` also writes the runtime manifest. The authenticated version
endpoint is `/api/share/v1/system/version`.
