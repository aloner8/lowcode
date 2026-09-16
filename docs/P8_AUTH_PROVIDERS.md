# P8 Auth provider checkpoint

The existing `auth.session` service remains the single App-member realm. P8 extends that contract instead of introducing another authentication store.

## Implemented contract

- Local registration is policy-controlled and assigns the App-local `member` role.
- Google, LINE, Facebook and Microsoft Entra use authorization-code flow with state, nonce and S256 PKCE. Provider subjects, not email alone, are the durable identity key.
- OAuth state is hashed, single-use, callback-bound and expires after ten minutes.
- LDAP and AD DS use `ldaps://`, a protected bind credential, escaped user/group filters and an end-user bind to verify the submitted password.
- Directory groups may map to existing App-local roles. Directory authentication never creates or changes a directory account.
- New access and refresh tokens carry `sessionVersion`; password changes and `revokeSessions()` invalidate issued sessions while preserving legacy-token compatibility during rollout.
- Provider credentials are server-only `env://LOWCODE_CONNECTION_*` SecretRefs. The browser receives provider names and redirects, never credentials or provider tokens.

## Runtime routes

- `GET /api/runtime/:slug/auth/providers/:provider/start`
- `GET /api/runtime/:slug/auth/providers/:provider/callback`
- Shared facade operations: `register`, `login`, `directoryLogin`, `providers`, `logout`, `me`, `refresh`, `revokeSessions`, `changePassword`.

The Template Studio Auth module exposes provider selection, registration policy and a same-origin post-login path. App overrides still cannot widen the Platform binding or secret policy.

## Verification boundary

The OAuth adapter is integration-tested against a real local HTTP socket, including token exchange, Bearer user-info request and stable-subject mapping. LDAP filter escaping and mandatory TLS are tested locally. A real Google/LINE/Facebook/Entra tenant and a test LDAP/AD directory still require protected external credentials/infrastructure; those provider-specific acceptance proofs are deferred and must not be represented as passed.
