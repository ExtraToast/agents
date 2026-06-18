# Tasks: Native Auth Token Bridge and App Shell Freeze

**Input**: Auth token bridge specification from `/specs/021-native-auth-token-bridge/spec.md`
**Prerequisites**: `specs/014-backend-gaps-program/`, `specs/015-verified-route-tables/`, `specs/017-shared-auth-client-capability/`, `specs/018-native-networking-origins/`, `specs/022-route-shell-foundation/`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or only reads source context
- **[Story]**: User story label from the spec, for example US1, US2, US3
- Exact implementation filenames are left to the implementation PR unless an existing file or directory is named below. Work must stay in the existing `services/agents-ui` ownership areas unless a later approved scaffold changes that.

## Phase 1: Contract and Backend Gate Verification

- [ ] T001 [P] Re-verify `services/agents-ui/src/lib/vueWebCommons.ts` web auth behavior: `VITE_AUTH_URL`, `/api/v1/auth/me`, `credentials: 'include'`, `XSRF-TOKEN`, `X-XSRF-TOKEN`, and `mapUser`
- [ ] T002 [P] Re-verify `services/agents-ui/src/router/index.ts` protected-route behavior and current direct dependency on `@/lib/vueWebCommons`
- [ ] T003 [P] Re-verify `services/agents-ui/src/layouts/AppShell.vue` hard-coded navigation ownership before replacing it with route-manifest navigation
- [ ] T004 Confirm backend G1 from `specs/014-backend-gaps-program/` has a committed OAuth2 AS contract for `/api/oauth2/*`, native PKCE public client registration, JWKS, token endpoint, revocation endpoint, and refresh-token rotation/reuse behavior
- [ ] T005 Confirm backend G2-G7 from `specs/014-backend-gaps-program/` are landed or gated before enabling native bearer release
- [ ] T006 Confirm verified auth return routes from `specs/015-verified-route-tables/spec.md` for `/api/v1/auth/confirm-email` and `/api/v1/auth/reset-password`

## Phase 2: Secure Storage and Local Unlock Foundation

**Goal**: Select and isolate native secret storage before implementing refresh-token persistence.

**Independent Test**: Storage-policy tests fail when secret-equivalent values are written outside the secure-storage adapter or transient memory.

- [ ] T007 [P] [US1] Audit candidate Capacitor secure-storage plugins for iOS Keychain backing, Android Keystore-backed encryption, non-plaintext secret storage, maintenance status, documented platform behavior, and testability
- [ ] T008 [P] [US5] Audit candidate biometric/platform credential unlock support and document fallback behavior for devices without enrolled biometrics
- [ ] T009 [US1] Define a secure-storage adapter under `services/agents-ui/src/lib/` that hides the selected plugin and exposes only refresh-token record operations
- [ ] T010 [US5] Define a local-unlock adapter under `services/agents-ui/src/lib/` that gates refresh-token reads before secure storage is accessed
- [ ] T011 [US1] Add tests under `services/agents-ui/src/__tests__/` proving `@capacitor/preferences`, localStorage, sessionStorage, IndexedDB, logs, and telemetry helpers are not used for refresh tokens, access tokens, authorization codes, PKCE verifiers, attach-tokens, confirmation tokens, or reset tokens
- [ ] T012 [US5] Add tests under `services/agents-ui/src/__tests__/` for biometric allow, biometric denial, unavailable biometric fallback, and locked restore state

## Phase 3: Frozen Auth Session Contracts

**Goal**: Establish the root auth/session API consumed by router guards, shell, transports, and feature slices.

**Independent Test**: Type-level or unit tests can mock one `AuthSessionPort` for router, shell, API, SSE, and WS consumers without importing implementation internals.

- [ ] T013 [US4] Define frozen auth/session contract types equivalent to `AuthRuntimeMode`, `AuthRestoreState`, `AuthUser`, `AccessTokenLease`, `AuthSessionPort`, `DeepLinkIntent`, and `DeepLinkResult` under `services/agents-ui/src/lib/`
- [ ] T014 [US4] Define shell guard/navigation contract types equivalent to `ShellAuthGuardPort` and `ShellNavigationContext` under the app-owned shell/router boundary
- [ ] T015 [US4] Add contract tests under `services/agents-ui/src/__tests__/` proving router guards, app shell navigation, and transport adapters can consume the auth port without importing native storage internals
- [ ] T016 [US4] Add static boundary coverage preventing feature code under `services/agents-ui/src/features/` from importing auth store internals, secure-storage adapters, or old auth/API primitives from `@/lib/vueWebCommons`

## Phase 4: Native PKCE Login and Restore

**Goal**: Native users can complete OAuth2 Authorization Code + PKCE login and restore sessions from secure refresh-token storage.

**Independent Test**: PKCE tests simulate browser handoff, callback validation, code exchange, secure refresh-token persistence, memory access-token storage, and cold-start restore.

- [ ] T017 [US1] Implement high-entropy PKCE verifier/challenge and state generation in the native auth path
- [ ] T018 [US1] Persist only non-secret pending login metadata needed to correlate callback state; do not persist the authorization code or token response
- [ ] T019 [US1] Implement system-browser OAuth2 authorize handoff for native mode using the `/api/oauth2/*` authorize contract
- [ ] T020 [US1] Implement OAuth2 callback deep-link handling that validates redirect URI, state, and verifier correlation before token exchange
- [ ] T021 [US1] Implement token exchange that stores only the rotating refresh token in secure storage and keeps the access token in memory
- [ ] T022 [US1] Implement native startup restore that waits for local unlock, reads the refresh token through the secure-storage adapter, refreshes, and loads current user/capabilities
- [ ] T023 [US1] Add tests for PKCE verifier/challenge generation, callback state mismatch, missing verifier, duplicate callback consumption, successful token exchange, and cold-start restore

## Phase 5: Web Cookie Auth Compatibility

**Goal**: Existing web users keep cookie/CSRF login behavior while the root auth surface abstracts over runtime mode.

**Independent Test**: Web auth tests prove requests use cookie credentials and CSRF, never bearer or native secure storage.

- [ ] T024 [US2] Implement web mode in the root auth surface using the existing `services/agents-ui/src/lib/vueWebCommons.ts` current-user behavior or an equivalent cookie/CSRF adapter
- [ ] T025 [US2] Preserve `credentials: 'include'`, `XSRF-TOKEN`, `X-XSRF-TOKEN`, and `/api/v1/auth/me` in web current-user and API paths
- [ ] T026 [US2] Ensure web mode never calls native secure storage, local unlock, or bearer token injection
- [ ] T027 [US2] Add tests for web restore with an auth-ui cookie, missing CSRF cookie on safe requests, logout behavior, and absence of bearer headers

## Phase 6: Rotation-Aware Refresh and Logout

**Goal**: Native refresh and logout fail closed and handle refresh-token rotation safely.

**Independent Test**: Auth store tests simulate concurrent refresh, rotated tokens, invalid/reused tokens, revoke failures, and WebView cookie cleanup.

- [ ] T028 [US5] Implement single-flight refresh so concurrent expired-token requests share one refresh exchange
- [ ] T029 [US5] Atomically replace the secure refresh-token record when the OAuth2 AS returns a rotated refresh token
- [ ] T030 [US5] Clear local token family and require re-login when refresh fails with invalid, missing, reused, revoked, or expired refresh-token semantics
- [ ] T031 [US5] Implement native logout revocation through the `/api/oauth2/*` revocation endpoint when a refresh token exists
- [ ] T032 [US5] Clear secure storage, in-memory access tokens, pending login state, auth state, and WebView cookies during native logout
- [ ] T033 [US5] Add tests for single-flight refresh, retry-after-refresh, atomic rotated-token replacement, refresh reuse failure, logout revocation, revoke failure cleanup, and cookie clearing

## Phase 7: Token-Aware REST, SSE, and WebSocket Wiring

**Goal**: Native bearer transports authenticate correctly without cookies, CSRF, user headers, or long-lived tokens in URLs.

**Independent Test**: Transport tests prove token injection, fetch-SSE bearer behavior, attach-token minting, and URL hygiene.

- [ ] T034 [US3] Connect `AuthSessionPort.getAccessToken()` to the bearer `ApiClientPort` path from `specs/017-shared-auth-client-capability/`
- [ ] T035 [US3] Implement native token-injecting fetch preparation for authenticated REST and chat stream requests with `Authorization: Bearer <access-token>`
- [ ] T036 [US3] Ensure native bearer request preparation omits cookie credentials, `X-XSRF-TOKEN`, CSRF cookie reads, and client-generated `X-User-Id`
- [ ] T037 [US3] Implement one refresh-and-retry path for expired access-token responses on idempotent or explicitly retryable requests
- [ ] T038 [US3] Replace bearer-mode status streaming with a fetch-based SSE parser or equivalent bearer-capable stream path
- [ ] T039 [US3] Wire terminal attach to mint a short-lived single-use attach-token through authenticated REST before opening browser `WebSocket`
- [ ] T040 [US3] Add tests proving web mode may still use credentialed `EventSource`, native bearer mode does not use standard `EventSource`, and WebSocket URLs contain attach-token plus cursor parameters but no access or refresh tokens

## Phase 8: Deep Links, Guards, Route Manifest, and App Shell

**Goal**: Feature slices register routes/navigation through frozen APIs, while guards restore auth and deep links route safely.

**Independent Test**: Fixture route modules exercise protected, public, admin, OAuth callback, email confirmation, and password reset flows without editing shared router or shell navigation.

- [ ] T041 [US4] Implement deep-link intent parsing for OAuth2 callback, email confirmation return, password reset return, and generic route restoration
- [ ] T042 [US4] Route email confirmation and password reset deep links to public feature routes rather than the OAuth2 callback path
- [ ] T043 [US4] Update router guard behavior in `services/agents-ui/src/router/` so protected routes wait for auth restoration and preserve attempted destinations
- [ ] T044 [US4] Update capability/admin route handling so unknown capabilities fail closed and authenticated users without capability are denied
- [ ] T045 [US4] Refactor `services/agents-ui/src/layouts/AppShell.vue` to consume route-manifest navigation instead of hard-coded nav entries
- [ ] T046 [US4] Add route manifest tests under `services/agents-ui/src/__tests__/` for deterministic ordering, duplicate names/IDs, public callback routes, protected restore, admin denial, and navigation filtering
- [ ] T047 [US4] Add static boundary coverage proving feature slices register through route modules and do not edit shared router, guard, auth store, or app-shell navigation internals

## Phase 9: Acceptance Verification

- [ ] T048 Run `pnpm --filter @extratoast/agents-ui typecheck`
- [ ] T049 Run `pnpm --filter @extratoast/agents-ui lint`
- [ ] T050 Run `pnpm --filter @extratoast/agents-ui test`
- [ ] T051 Run `pnpm --filter @extratoast/agents-ui build`
- [ ] T052 Run `pnpm --filter @extratoast/agents-ui depcruise`
- [ ] T053 When the Capacitor scaffold exists, run the native e2e smoke path from `specs/020-build-release-native-e2e/`
- [ ] T054 Confirm native bearer release remains disabled unless backend G1-G7 gates from `specs/014-backend-gaps-program/` are green

## Dependencies

- T001 through T006 precede implementation because they establish current behavior and backend gates.
- T007 through T012 precede native token persistence because refresh-token storage must be secure before login can store tokens.
- T013 through T016 precede feature fan-out because later slices must consume stable auth/session and shell contracts.
- T017 through T023 depend on T007 through T016.
- T024 through T027 may run in parallel with native PKCE after T013 through T016 because web mode uses a separate adapter.
- T028 through T033 depend on native PKCE and secure storage.
- T034 through T040 depend on the auth session port and token lifecycle, and also on the transport contracts from specs 017 and 018.
- T041 through T047 depend on the shell contracts and route foundation from spec 022.
- T048 through T054 run after implementation and before merge/release.

## Parallel Example

```text
T001 [P] Re-verify vueWebCommons web auth behavior
T002 [P] Re-verify router auth behavior
T003 [P] Re-verify AppShell navigation ownership
T007 [P] Audit secure-storage plugins
T008 [P] Audit biometric/platform credential support
```

```text
T024 [US2] Implement web mode in the root auth surface
T028 [US5] Implement single-flight refresh
T041 [US4] Implement deep-link intent parsing
```

## Downstream Handoff

- Signup and account feature specs should use `DeepLinkIntent` for email confirmation and password reset returns and should not implement their own secret storage.
- Admin/account feature specs should read current user and capabilities from `AuthSessionPort`, not from commons auth hooks.
- Terminal/status specs should use the bearer-capable SSE and attach-token wiring defined here and the URL/origin helpers from spec 018.
- Backend tasks remain responsible for OAuth2 AS/JWKS, refresh-token reuse detection, CORS, SSE auth, attach-token enforcement, and owner isolation.
