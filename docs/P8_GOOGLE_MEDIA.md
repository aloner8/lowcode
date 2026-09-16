# P8 Google Workspace and local Media checkpoint

This checkpoint extends the same versioned ShareModule catalog and runtime
facade used by Auth, Files, and Mail. It does not add a generic HTTP proxy.

## Google Workspace

`google.workspace@1.0.0` exposes fixed server-side adapters for Maps embed,
Calendar, Drive, Forms, Vision OCR, and Gemini generation. Calendar, Drive,
and Forms preserve provider pagination. Calendar writes require an idempotency
key through the common dispatcher. OAuth access/refresh tokens and Google API
keys remain protected `SecretRef` values and are never returned to the browser.

Maps is the one intentional browser-key exception: the binding contains a
browser Maps key that is returned only inside a Google Maps embed URL. Deployers
must restrict that key by web origin and API in Google Cloud. It must not share
credentials with server-side Vision or Gemini.

Gemini structured output accepts a bounded JSON-schema subset. Unsupported or
excessively deep schemas are rejected before a provider request, and provider
output is validated again before it reaches the App.

## Local Media

`media.local@1.0.0` generates SVG/PNG QR codes without Google credentials and
resizes JPEG/PNG/WebP images using Sharp. Resize reads only a tenant `FileRef`
inside the binding namespace, enforces input byte/pixel bounds, and writes a
content-addressed result back to tenant storage. Absolute paths and cross-App
paths never enter the contract.

Studio exposes QR, Google Map, Google Calendar, and Google Form components with
the same typed client calls used by Runtime. Module settings independently gate
Google features and QR/image operations.

## Verification and deferred proof

- Contract/facade tests cover feature gates, binding validation, and typed calls.
- Google adapter tests prove fixed endpoints, bounded pagination, server-only
  authorization, Maps URL construction, and structured-schema rejection.
- Media integration tests generate a real QR code and resize a real image in a
  disposable tenant-storage directory, including namespace rejection.

A real Google test account/Cloud project is not available in protected storage.
Consent, revoked-token, real quota, Vision, Forms, Drive, Calendar, and Gemini
acceptance against Google therefore remain deferred and must not be represented
as passed. The local Media proof is complete and requires no Google credential.

## Rollback

Disable the `google` or `media` module in a new App revision and roll back the
runtime image/package together. No Core DB migration is introduced by this
checkpoint. Do not remove generated media files during rollback; they remain
ordinary tenant assets and may still be referenced by an older revision.
