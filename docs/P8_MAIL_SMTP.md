# P8 Mail SMTP checkpoint

This checkpoint adds a real SMTP transport while preserving the existing HTTP provider path.

## Contract

- `modules.mail.send({ to, cc?, template, data?, attachments? })` queues a durable job and returns `queued`.
- `modules.mail.preview(...)` renders the exact escaped subject/HTML without sending.
- `modules.mail.status(jobId)` returns `queued`, `processing`, `accepted`, `failed`, or `unknown`.
- Recipient headers reject control characters and invalid addresses. Template variables are HTML-escaped.
- Attachments are tenant FileRef paths. Their bytes, name, MIME type, size, and SHA-256 are snapshotted when queued so retries cannot silently send changed content.

## SMTP connection

SMTP metadata may be stored in an `SMTP` Connection Profile; credentials remain protected `env://LOWCODE_CONNECTION_*` references. Service bindings use the same protected namespace and support `none` or `basic` auth plus `none`, `starttls`, or implicit `tls` transport.

`accepted` means the SMTP server accepted the message. It does not prove inbox delivery. A connection reset/timeout with ambiguous delivery is marked `unknown` and is not automatically retried. Administrators must inspect that job before retrying.

## Worker recovery

Workers claim jobs with `FOR UPDATE SKIP LOCKED`, a unique worker ID, and a two-minute lease. A later worker may reclaim an expired `processing` lease. Ordinary failures use bounded exponential backoff; terminal failures remain `failed`.

## Verification and rollback

- The SMTP integration test opens a real local SMTP socket and verifies To/CC and multiple MIME attachments.
- A clean PostgreSQL 17 database applies migrations `001–034`; SMTP profile and outbox status constraints plus lease columns are inspected after migration.
- Rollback the runtime before the schema. The additive columns and broader status/profile constraints are backward-compatible with the prior HTTP worker. Do not drop P8 columns while P8 workers or queued SMTP jobs exist.

External provider proof still requires a protected test SMTP credential. No credential is stored in this repository or accepted through chat.

