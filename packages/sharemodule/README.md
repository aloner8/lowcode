# @matchanu/sharemodule

Shared implementation used by the platform and site runtimes. Version 0.4.0
ships compiled contracts, catalog, typed clients and React components for Auth,
Files, Mail, Google Workspace and local Media. Runtime code selects versioned
server bindings; browser components never receive provider credentials.

```tsx
import { FileManager, GoogleMap, Login, QRCode, ShareModuleProvider } from '@matchanu/sharemodule/react';

<ShareModuleProvider baseUrl="/api/runtime/town/modules">
  <Login afterLogin="/dashboard" />
  <FileManager currentPath="/uploads/documents" multiple onSelect={setFiles} />
  <QRCode value="https://example.test/ticket/42" size={192} />
  <GoogleMap center={{ lat: 13.7563, lng: 100.5018 }} />
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
await modules.google.calendar.list({ calendarId: 'primary' });
await modules.media.image.resize({ file: 'shared/uploads/photo.jpg', width: 1200 });
```

Inside React, `useModules()` also supplies `await modules.files.pick({ currentPath,
multiple: true })`. Mount `ShareModuleProvider` inside the application's
`StorageScopeProvider` once. Cancellation resolves to `null` for a single file
or `[]` for multiple files, including when the provider unmounts.

Mail supports versioned HTTP or SMTP bindings, CC, immutable attachment
snapshots, template preview, and a durable outbox worker. Auth supports local
registration plus configured OAuth and LDAPS/AD DS providers. Google and Media
features are separately gated in each App revision. Multiple bindings require
`snapshot.moduleDefaults[module]` to select a default; disabled or missing
bindings fail explicitly. The administrator realm continues using its existing
login rather than accepting tenant credentials.

Build with `npm run build:modules` from the repository root. Exports resolve to
compiled `dist` files; frontend entry points do not import server adapters.
`npm run build` also writes the runtime manifest. The authenticated version
endpoint is `/api/share/v1/system/version`. Run `npm run release:verify` before
creating a `sharemodule-v<version>` tag. The runtime image also contains the
outbox entrypoint `node scripts/service-worker.mjs`.
