# Implementation Plan: Native Auth Token Bridge and App Shell Freeze

**Branch**: `021-native-auth-token-bridge` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-native-auth-token-bridge/spec.md`

## Summary

Freeze the auth/session and shell contracts for the Capacitorized `services/agents-ui` app. Native mode uses Authorization Code + PKCE against `/api/oauth2/*`, keeps access tokens in memory, stores only rotating refresh tokens in validated Keychain/Keystore-backed storage, gates local refresh-token use behind biometric/platform credential unlock, and wires bearer-capable fetch/SSE/WS behavior. Web mode keeps the existing cookie/CSRF flow. The shell consumes one root auth surface for route guards, route manifest filtering, app navigation, deep links, and feature-facing API transport.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x, Vue Router 5.1.x, Pinia 3.x, Capacitor 7 target from `specs/013-native-target-adr/`
**Primary Dependencies**: `@extratoast/vue-web-commons` `^0.3.0`, browser `fetch`, browser `WebSocket`, fetch-stream SSE parser to be selected or implemented, secure-storage and biometric plugins to be audited before adoption
**Storage**: Native secrets only in Keychain/Keystore-backed secure storage; access tokens in memory only; `@capacitor/preferences` only for non-secret flags
**Testing**: Vitest unit/component tests for auth store, guards, route manifest, storage policy, transport adapters, deep links, and static boundaries; native e2e smoke later through Maestro per `specs/020-build-release-native-e2e/`
**Target Platform**: Existing web browser build and Capacitor Android/iOS WebView
**Project Type**: Existing `services/agents-ui` Vue app
**Performance Goals**: Auth restoration must not add visible navigation flicker; concurrent expired-token responses must collapse to one refresh exchange; token injection adds only async token lookup overhead
**Constraints**: Do not use native HTTP plugins for primary transports; do not store secrets in plaintext; do not place long-lived bearer material in URLs; preserve web cookie/CSRF; do not ship native bearer mode before backend G1-G7 are available
**Scale/Scope**: One root auth session surface, one native token lifecycle, one web compatibility path, one shell guard/nav contract, and transport hooks for REST, fetch streams, SSE, and WS attach

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Claude/Codex parity is unchanged; this task adds only Spec Kit documents
- [x] No render-managed artifacts are touched
- [x] Small stacked PR boundary is clear: this slice owns auth/session and shell contract freeze, not feature screen implementation or backend work
- [x] Verification command is identified for documentation and downstream implementation

## Project Structure

### Documentation

```text
specs/021-native-auth-token-bridge/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Existing Source Ownership Areas

```text
services/agents-ui/src/lib/
services/agents-ui/src/router/
services/agents-ui/src/layouts/AppShell.vue
services/agents-ui/src/features/
services/agents-ui/src/__tests__/
```

### Existing Files Read For This Plan

```text
services/agents-ui/src/lib/vueWebCommons.ts
services/agents-ui/src/router/index.ts
services/agents-ui/src/layouts/AppShell.vue
services/agents-ui/package.json
specs/014-backend-gaps-program/spec.md
specs/015-verified-route-tables/spec.md
specs/017-shared-auth-client-capability/spec.md
specs/018-native-networking-origins/spec.md
specs/022-route-shell-foundation/spec.md
```

**Structure Decision**: Implement auth/session contracts in `services/agents-ui/src/lib/` next to the existing commons wrapper and runtime-origin/auth-transport work. Keep router creation, guard installation, route discovery, and route manifest assembly in `services/agents-ui/src/router/`. Refactor `services/agents-ui/src/layouts/AppShell.vue` to consume shell navigation derived from the route manifest instead of owning a hard-coded list. Feature slices may define their own route modules through the convention from `specs/022-route-shell-foundation/`, but must not import native storage or old cookie-only auth primitives directly.

## Phase 0: Evidence and Backend Contract Gates

1. Reconfirm the current web auth anchors in `vueWebCommons.ts`: `VITE_AUTH_URL`, `/api/v1/auth/me`, `credentials: 'include'`, `XSRF-TOKEN`, `X-XSRF-TOKEN`, and `mapUser`.
2. Reconfirm the current router and shell collision points in `router/index.ts` and `AppShell.vue`.
3. Verify the implementation-time OAuth2 AS contract from `specs/014-backend-gaps-program/` or a committed auth-api contract artifact before relying on `/api/oauth2/*` endpoint names, parameters, revocation semantics, refresh-token rotation, JWKS, or native public client registration.
4. Verify backend G1-G7 are landed or explicitly environment-gated before enabling native bearer release.

**Gate**: Native bearer auth may be developed behind flags/mocks, but it must not be released until backend OAuth2/JWKS, CORS, SSE auth, attach-token, and owner isolation gates pass.

## Phase 1: Secure Storage and Local Unlock Policy

1. Audit candidate Capacitor-compatible secure-storage plugins for all required behavior:
   - iOS Keychain backing;
   - Android Keystore-backed encryption;
   - no plaintext SharedPreferences for secrets;
   - device-lock/biometric access control support or compatible composition with a biometric credential plugin;
   - maintained package, documented platform behavior, and testability.
2. Select a secure-storage adapter abstraction before adopting a plugin. Keep plugin calls behind the root auth store.
3. Define a local-unlock policy that gates refresh-token reads through biometric or platform credential unlock. Specify fallback behavior for devices without enrolled biometrics.
4. Prohibit `@capacitor/preferences`, localStorage, sessionStorage, IndexedDB, logs, telemetry, and screenshots from storing or exposing secret-equivalent values.

**Gate**: Storage policy tests must fail if code writes refresh tokens, access tokens, authorization codes, PKCE verifiers, attach-tokens, reset tokens, or confirmation tokens outside the secure storage adapter or transient memory.

## Phase 2: Auth Session Store and Native PKCE Flow

1. Define the frozen auth/session types from the spec: `AuthRuntimeMode`, `AuthRestoreState`, `AuthUser`, `AccessTokenLease`, `AuthSessionPort`, `DeepLinkIntent`, and `DeepLinkResult`.
2. Implement web mode as a compatibility adapter over existing cookie/CSRF auth behavior and current-user mapping.
3. Implement native login as Authorization Code + PKCE:
   - generate high-entropy verifier and state;
   - persist only pending non-secret state needed to validate callback;
   - open the authorize URL through the system browser;
   - validate redirect URI, state, and verifier correlation;
   - exchange code and verifier at the token endpoint;
   - keep access tokens in memory and persist only the rotating refresh token in secure storage.
4. Implement native restore:
   - wait for local unlock before reading refresh token;
   - refresh to obtain a memory access token;
   - load current user/capabilities through bearer auth;
   - resolve to authenticated, anonymous, locked, or failed state.
5. Implement rotation-aware refresh with single-flight concurrency and atomic refresh-token replacement.
6. Implement logout with refresh-token revocation, secure-storage clearing, memory clearing, pending-state clearing, and WebView cookie clearing.

**Gate**: Auth store tests cover PKCE validation, callback failure, startup restore, biometric denial, refresh rotation, refresh reuse/failure, concurrent refresh, logout revocation, and web cookie compatibility.

## Phase 3: Token-Aware Transport Wiring

1. Integrate native `AuthSessionPort.getAccessToken()` with the `BearerAuthAdapter`/`ApiClientPort` from `specs/017-shared-auth-client-capability/`.
2. Add token-injecting fetch preparation for native bearer REST and fetch streams:
   - no cookies;
   - no CSRF headers;
   - no client-generated `X-User-Id`;
   - retry once after refresh for eligible expired-token failures.
3. Preserve web cookie/CSRF mode through the existing CSRF behavior.
4. Replace bearer-mode status streaming with fetch-based SSE because standard `EventSource` cannot send Authorization headers.
5. Wire WebSocket attach to mint a short-lived single-use attach-token through authenticated REST before opening browser `WebSocket`.

**Gate**: Transport tests prove web requests never emit bearer headers, native requests never read CSRF cookies, bearer SSE does not use standard `EventSource`, and WS URLs never contain access or refresh tokens.

## Phase 4: Deep Links, Router Guards, and Shell Freeze

1. Define the deep-link parser for OAuth2 callback, email confirmation return, password reset return, and generic route restoration.
2. Route OAuth2 callbacks to native auth handling only after state/verifier validation. Route email confirmation and password reset links to public feature routes and never through the OAuth2 callback path.
3. Define `ShellAuthGuardPort` and `ShellNavigationContext` so route guards and navigation filtering do not import auth internals.
4. Update the route guard design so protected routes wait for `restoreForRoute()` before allow/redirect/deny decisions.
5. Connect the route manifest from `specs/022-route-shell-foundation/` to shell navigation. `AppShell.vue` should render manifest-derived navigation and actions rather than owning hard-coded shared nav.
6. Add static boundaries forbidding feature slices from editing/importing shared router, guard, auth store internals, native secure storage, and old cookie-only auth/API primitives.

**Gate**: Route and shell tests prove protected deep links wait for auth restoration, admin routes fail closed, public callback/reset routes do not loop, and fixture feature route modules can register navigation without shared file edits.

## Phase 5: Verification

Run after implementation:

```bash
pnpm --filter @extratoast/agents-ui typecheck
pnpm --filter @extratoast/agents-ui lint
pnpm --filter @extratoast/agents-ui test
pnpm --filter @extratoast/agents-ui build
pnpm --filter @extratoast/agents-ui depcruise
```

Native follow-up verification when the Capacitor scaffold exists:

```bash
pnpm --filter @extratoast/agents-ui test:e2e
```

Documentation-only verification for this task:

```bash
test -f specs/021-native-auth-token-bridge/spec.md \
  && test -f specs/021-native-auth-token-bridge/plan.md \
  && test -f specs/021-native-auth-token-bridge/tasks.md \
  && grep -qi pkce specs/021-native-auth-token-bridge/spec.md \
  && grep -qi 'keychain\|keystore' specs/021-native-auth-token-bridge/spec.md
```

## Risks And Mitigations

- **Unverified OAuth2 AS details**: Block native bearer release on the backend contract artifact from `specs/014-backend-gaps-program/`; do not guess token endpoint payloads beyond the OAuth2/PKCE contract.
- **Insecure storage plugin**: Require plugin audit and storage-policy tests before storing refresh tokens.
- **Biometric inconsistency across devices**: Define a platform credential fallback or require full login; never silently bypass local unlock for refresh-token use.
- **Refresh-token rotation races**: Use single-flight refresh and atomic secure-storage replacement.
- **Web auth regression**: Preserve cookie/CSRF as a first-class mode with tests.
- **Stream auth gaps**: Fetch-SSE and attach-token tests must prove native bearer mode does not open unauthenticated streams or sockets.
- **Parallel feature conflicts**: Freeze auth/session, guard, route manifest, and navigation contracts before feature fan-out.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Root auth/session port plus mode-specific adapters | Web cookie auth and native bearer auth have different credential and storage models | Reusing the current commons wrapper directly is cookie/CSRF-only from local source |
| Fetch-based SSE in bearer mode | Standard `EventSource` cannot send Authorization headers | Opening unauthenticated EventSource would break native auth and backend trust requirements |
| Secure-storage plugin audit gate | Refresh tokens are long-lived credentials | `@capacitor/preferences` and browser storage are plaintext or inappropriate for native secrets |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Evidence captured in spec and plan; backend contract verification deferred to implementation
- [ ] Phase 1: Secure storage and local unlock policy
- [ ] Phase 2: Auth session store and native PKCE flow
- [ ] Phase 3: Token-aware transport wiring
- [ ] Phase 4: Deep links, router guards, and shell freeze
- [ ] Phase 5: Verification

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
