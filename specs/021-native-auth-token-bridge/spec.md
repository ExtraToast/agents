# Feature Specification: Native Auth Token Bridge and App Shell Freeze

**Feature Branch**: `021-native-auth-token-bridge`
**Created**: 2026-06-16
**Status**: Draft
**Input**: Spec native auth and the frozen app shell: root auth store, token interceptor, router guards, app shell, route manifest, Authorization Code + PKCE against `/api/oauth2/*`, secure refresh-token storage, memory-first access tokens, token-aware fetch/SSE/WS wiring, biometric unlock, logout revocation, and separate web/native/deep-link flows.

## Scope

This feature freezes the client auth/session and shell interfaces that later auth, account, admin, signup, and agents feature slices consume. It is the native auth bridge slice for the Capacitorized `services/agents-ui` app and the compatibility contract for the existing web build.

Verified current-state anchors in this checkout:

- `services/agents-ui/src/lib/vueWebCommons.ts` uses cookie/CSRF auth with `VITE_AUTH_URL`, `/api/v1/auth/me`, `credentials: 'include'`, `XSRF-TOKEN`, and `X-XSRF-TOKEN`.
- `services/agents-ui/src/router/index.ts` owns one shared route array, imports `useAuth` from `@/lib/vueWebCommons`, and redirects unauthenticated users to auth-ui with `window.location.href`.
- `services/agents-ui/src/layouts/AppShell.vue` owns a hard-coded navigation list for Sessions, Projects, and Repositories.
- `specs/017-shared-auth-client-capability/` requires an app-owned `ApiClientPort` with web `cookie-csrf` and native `bearer` transports.
- `specs/018-native-networking-origins/` requires absolute origins, native bearer fetch, fetch-based SSE for bearer mode, and REST-minted WebSocket attach-tokens.
- `specs/022-route-shell-foundation/` owns route discovery and route-module registration; this spec owns the auth/session hooks the guards call and the shell contract feature slices consume.
- `specs/014-backend-gaps-program/` owns backend OAuth2 AS/JWKS, refresh-token rotation/reuse detection, JWT validation, CORS, SSE auth, and attach-token backend milestones. The auth-api source is not present in this checkout, so `/api/oauth2/*` endpoint behavior must be verified by that backend contract before native release.

## User Scenarios & Testing

### User Story 1 - Native PKCE Login Restores A Session (Priority: P1)

A native user can sign in through the system browser using Authorization Code + PKCE, return to the app by deep link, and restore a protected route without storing access tokens at rest.

**Why this priority**: Capacitor cannot rely on the current cookie-only auth wrapper. Native needs a bearer-capable OAuth2 flow while keeping long-lived credentials out of JavaScript-readable plaintext storage.

**Independent Test**: Native auth tests simulate PKCE verifier/challenge generation, browser handoff, deep-link callback handling, token exchange, refresh-token secure storage, access-token memory storage, and guard restoration from a cold start.

**Acceptance Scenarios**:

1. **Given** the app runs under Capacitor with no session, **When** the user starts login, **Then** the app creates a high-entropy PKCE verifier, stores only pending non-secret login state locally, opens the OAuth2 authorize URL under `/api/oauth2/*` in the system browser, and does not use a client secret.
2. **Given** the OAuth2 browser flow returns to the registered app callback, **When** the app validates state and exchanges the authorization code with the verifier, **Then** it stores only the rotating refresh token in Keychain/Keystore-backed secure storage and keeps the access token in memory.
3. **Given** a protected route is requested on cold start, **When** biometric unlock authorizes local refresh-token use and refresh succeeds, **Then** the guard waits for restoration and continues to the requested route.

---

### User Story 2 - Web Keeps Cookie Login And CSRF (Priority: P1)

A web user continues using the existing cookie/CSRF login model without bearer-token storage or native secure-storage plugins.

**Why this priority**: The current web deployment depends on auth-ui cookies, `XSRF-TOKEN`, `X-XSRF-TOKEN`, and browser credentials. Native auth must not regress that path.

**Independent Test**: Web auth tests assert the shell uses `cookie-csrf` transport, sends `credentials: 'include'`, uses `X-XSRF-TOKEN` when present, and never reads native secure storage.

**Acceptance Scenarios**:

1. **Given** the app runs in a normal browser with an auth-ui session cookie, **When** auth state restores, **Then** it calls the existing current-user route with cookie credentials and maps the user through the existing role mapping.
2. **Given** web mode sends an authenticated API request, **When** the `XSRF-TOKEN` cookie exists, **Then** the request includes `X-XSRF-TOKEN` and no `Authorization` bearer header.
3. **Given** web logout is requested, **When** logout completes, **Then** the app clears local auth state through the web auth path and does not attempt native refresh-token revocation unless a native refresh token exists.

---

### User Story 3 - Token-Aware Native Transports (Priority: P1)

Native REST, chat streaming, status streaming, and terminal attach use short-lived access tokens or attach-tokens without leaking long-lived bearer material into URLs.

**Why this priority**: Standard `EventSource` and browser `WebSocket` cannot set arbitrary Authorization headers, while native bearer mode must authenticate streams and sockets.

**Independent Test**: Transport tests run in native bearer mode and prove fetch requests receive `Authorization: Bearer <access-token>`, SSE uses a fetch-stream parser instead of standard `EventSource`, and WebSocket attach first mints a short-lived attach-token through authenticated REST.

**Acceptance Scenarios**:

1. **Given** native bearer mode has a valid access token, **When** REST or chat stream requests are sent, **Then** the token-injecting fetch path adds `Authorization: Bearer <access-token>` and omits cookie credentials and `X-XSRF-TOKEN`.
2. **Given** native bearer mode opens session status streaming, **When** the stream starts, **Then** it uses a fetch-based SSE implementation that can send Authorization headers and can refresh/retry through the auth session surface.
3. **Given** terminal attach starts in web or native mode, **When** the socket opens, **Then** the app obtains a short-lived single-use attach-token through authenticated REST and puts only that attach-token plus replay cursor parameters in the WebSocket URL.

---

### User Story 4 - Frozen Shell And Route Manifest APIs (Priority: P1)

Feature slices can register routes, navigation entries, auth requirements, and shell actions without editing shared router, guard, or navigation files.

**Why this priority**: Parallel feature slices must not collide in `src/router/index.ts` or `AppShell.vue`, and protected deep links must use one auth restoration contract.

**Independent Test**: Route discovery and shell tests register fixture route modules with public, authenticated, admin, and callback/deep-link routes, then verify deterministic route manifest output, guard behavior, and navigation filtering.

**Acceptance Scenarios**:

1. **Given** a feature route module registers a protected route, **When** route discovery builds the route manifest, **Then** the shell guard evaluates `requiresAuth` and capability metadata through the frozen auth session API.
2. **Given** a feature route module registers navigation entries, **When** the app shell renders navigation, **Then** it filters entries by auth state and capability without feature code editing `AppShell.vue`.
3. **Given** email confirmation or password reset returns through an app link/universal link, **When** the deep-link parser receives the URL, **Then** it routes to a public feature-owned return route without triggering a protected-route restore loop.

---

### User Story 5 - Rotation-Aware Logout And Refresh Failure Handling (Priority: P1)

A user can refresh and logout safely across native and web, including refresh-token rotation, reuse detection, WebView cookie cleanup, and offline or biometric-denied states.

**Why this priority**: Native refresh tokens are long-lived credentials. The app must handle token rotation atomically and fail closed when local unlock or server refresh is not available.

**Independent Test**: Auth store tests simulate access-token expiry, concurrent requests, refresh-token rotation, refresh failure, biometric denial, logout revocation, and WebView cookie clearing.

**Acceptance Scenarios**:

1. **Given** multiple native requests receive an expired-token response, **When** refresh starts, **Then** only one refresh exchange runs and waiting requests retry with the new access token or fail through one logout path.
2. **Given** refresh succeeds with a rotated refresh token, **When** the token response is persisted, **Then** the secure-storage value is replaced atomically before the old token is discarded.
3. **Given** logout is requested in native mode, **When** a refresh token exists, **Then** the app calls the OAuth2 revocation endpoint under `/api/oauth2/*`, clears secure storage, clears in-memory tokens, and clears WebView cookies before returning to the logged-out shell.

### Edge Cases

- `@capacitor/preferences` is plaintext and must be used only for non-secret flags such as last selected auth mode or pending-login metadata that cannot grant access.
- If the secure-storage plugin cannot prove Keychain/Keystore-backed secret storage, native auth implementation is blocked.
- If biometric unlock is unavailable on a device, the implementation must use the approved platform credential fallback or require full re-login; it must not silently use the refresh token without the configured local-unlock policy.
- If the OAuth2 callback state or PKCE verifier is missing or mismatched, the callback must fail closed and clear pending login state.
- If refresh-token reuse is reported by the authorization server, the app must clear the token family locally and require login.
- If WebView cookie clearing fails during native logout, the app must still clear native secure storage and surface a retryable logout-cleanup state.
- If a deep link contains confirmation or reset tokens, those tokens must not be logged, persisted in telemetry, displayed in shell navigation, or copied into crash reports.
- Standard `EventSource` is allowed only where browser-managed credentials are sufficient; bearer mode must not open an unauthenticated `EventSource`.
- Long-lived access tokens, refresh tokens, authorization codes, PKCE verifiers, and attach-tokens must not be stored in localStorage, sessionStorage, IndexedDB, `@capacitor/preferences`, logs, query history beyond required callback processing, screenshots, or analytics.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST define one root auth session store/surface that owns web cookie auth, native PKCE auth, restoration, refresh, logout, current user, capabilities, and transport mode.
- **FR-002**: The root auth surface MUST expose a frozen `AuthSessionPort` used by router guards, shell navigation, `ApiClientPort`, fetch/SSE/WS transports, and feature code.
- **FR-003**: Native login MUST use OAuth2 Authorization Code + PKCE against the backend OAuth2 AS under `/api/oauth2/*` with a public client registration and no client secret.
- **FR-004**: Native login MUST use a system browser handoff and registered app callback/deep link; embedded credential collection in the WebView is not allowed for the OAuth2 authorization screen.
- **FR-005**: The native callback handler MUST validate state, code verifier correlation, redirect URI, and one-time consumption before exchanging a code for tokens.
- **FR-006**: Native storage MUST store only rotating refresh tokens as secrets, and only in a validated Keychain/Keystore-backed secure-storage plugin.
- **FR-007**: `@capacitor/preferences` MUST NOT store refresh tokens, access tokens, authorization codes, PKCE verifiers, attach-tokens, passwords, TOTP secrets, confirmation tokens, reset tokens, or any credential-equivalent value.
- **FR-008**: Access tokens MUST be memory-first: held only in process memory, refreshed as needed, and cleared on app background policy, logout, refresh failure, and process restart.
- **FR-009**: Refresh-token use from local secure storage MUST be gated by biometric or platform credential unlock according to the local-unlock policy before the token is read or sent.
- **FR-010**: Native refresh MUST be rotation-aware: serialize concurrent refreshes, atomically replace the stored refresh token on success, detect missing/invalid/reused refresh-token responses, and fail closed to logout/re-login.
- **FR-011**: Native logout MUST revoke the stored refresh token through the OAuth2 AS revocation endpoint under `/api/oauth2/*` when available, clear secure storage, clear in-memory access tokens, clear pending login state, and clear WebView cookies.
- **FR-012**: Web auth MUST preserve cookie/CSRF behavior with browser cookies, `credentials: 'include'`, `XSRF-TOKEN`, `X-XSRF-TOKEN`, and the existing `/api/v1/auth/me` current-user mapping.
- **FR-013**: Web mode MUST NOT use native secure storage, biometric unlock, PKCE token storage, or bearer-token injection unless a later spec explicitly changes web auth.
- **FR-014**: Native bearer fetch MUST inject `Authorization: Bearer <access-token>` for authenticated REST and fetch streams and MUST omit cookie credentials, CSRF headers, and client-generated `X-User-Id`.
- **FR-015**: Native bearer fetch MUST refresh once on an expired-token response before retrying an idempotent request or a request explicitly marked retryable by the caller.
- **FR-016**: Bearer-mode SSE MUST use a fetch-stream SSE parser or equivalent bearer-capable stream path; standard `EventSource` MUST NOT be used in bearer mode.
- **FR-017**: WebSocket attach MUST obtain a short-lived single-use attach-token through authenticated REST and MUST NOT place access tokens, refresh tokens, cookies, or spoofable user identifiers in the WebSocket URL.
- **FR-018**: The app MUST define deep-link intents for OAuth2 callback, email confirmation return, password reset return, and generic route restoration.
- **FR-019**: Deep-link handling MUST route email confirmation and password reset returns to public routes verified under `/api/v1/auth/confirm-email` and `/api/v1/auth/reset-password` rather than treating them as login callbacks.
- **FR-020**: Router guards MUST wait for auth restoration before allowing or redirecting protected routes and MUST preserve the attempted destination across login.
- **FR-021**: Admin and capability-gated routes MUST fail closed while auth state or capabilities are unknown.
- **FR-022**: The app shell MUST build navigation from the route manifest/feature route modules, not from a hard-coded shared list in `AppShell.vue` after this interface lands.
- **FR-023**: Feature slices MUST register routes and navigation through the frozen route manifest interface and MUST NOT edit shared router, guard, auth store, or app-shell navigation internals.
- **FR-024**: Feature code MUST consume only the frozen auth/session and API transport ports for auth state, current user, capabilities, authenticated requests, streams, and socket attach.
- **FR-025**: Static checks MUST block feature code from importing old cookie-only auth/API primitives directly from `@/lib/vueWebCommons` or from reading native secret storage directly.
- **FR-026**: The implementation MUST include tests for native PKCE state/verifier validation, secure-storage policy, biometric-gated refresh, rotation, logout revocation, cookie clearing, web cookie/CSRF preservation, fetch token injection, fetch-SSE bearer mode, WS attach-token minting, and guard restoration.
- **FR-027**: Native bearer release MUST remain blocked until backend G1-G7 from `specs/014-backend-gaps-program/` are available for OAuth2/JWKS, refresh rotation, JWT validation, CORS, SSE auth, attach-token, and owner isolation.

### Frozen Auth And Shell Contracts

The exact filenames are implementation-owned, but the app MUST freeze equivalent contracts before feature fan-out:

```ts
export type AuthRuntimeMode = 'web-cookie' | 'native-bearer'
export type AuthRestoreState = 'unknown' | 'restoring' | 'authenticated' | 'anonymous' | 'locked'
export type AuthCapability = string

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'ADMIN' | 'USER' | 'READONLY'
  capabilities: AuthCapability[]
}

export interface AccessTokenLease {
  token: string
  expiresAt: number
}

export interface AuthSessionPort {
  mode: AuthRuntimeMode
  state: AuthRestoreState
  user: AuthUser | null
  restore(destination?: string): Promise<AuthUser | null>
  login(options?: { redirectTo?: string }): Promise<void>
  handleDeepLink(url: string): Promise<DeepLinkResult>
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<AccessTokenLease | null>
  refresh(reason: 'startup' | 'foreground' | 'request-retry' | 'manual'): Promise<AccessTokenLease | null>
  logout(reason: 'user' | 'expired' | 'revoked' | 'security'): Promise<void>
  hasCapability(capability: AuthCapability): boolean
}

export type DeepLinkIntent =
  | { kind: 'oauth-callback'; url: string }
  | { kind: 'email-confirmation'; url: string }
  | { kind: 'password-reset'; url: string }
  | { kind: 'route'; url: string }

export interface DeepLinkResult {
  intent: DeepLinkIntent
  routeName?: string
  redirectTo?: string
}
```

The route/shell layer MUST consume the auth port through guard hooks equivalent to:

```ts
export interface ShellAuthGuardPort {
  restoreForRoute(destination: string): Promise<AuthUser | null>
  requireLogin(destination: string): Promise<void>
  canAccess(capability?: AuthCapability): boolean
}

export interface ShellNavigationContext {
  authState: AuthRestoreState
  user: AuthUser | null
  hasCapability(capability: AuthCapability): boolean
}
```

### Key Entities

- **AuthSessionPort**: Root auth surface consumed by router guards, app shell, API client, SSE, WS attach, and feature slices.
- **AuthRuntimeMode**: Runtime discriminator selecting web cookie/CSRF or native bearer behavior.
- **Native PKCE flow**: OAuth2 Authorization Code + PKCE browser handoff, callback validation, token exchange, refresh rotation, and revocation.
- **Secure refresh-token record**: The only native secret persisted at rest, stored in Keychain/Keystore-backed secure storage after local unlock policy allows use.
- **AccessTokenLease**: In-memory access token and expiry metadata used by token-injecting fetch and stream clients.
- **Local unlock policy**: Biometric or platform credential gate required before a native refresh token is read from secure storage.
- **Token-injecting fetch**: Native bearer request path that obtains an access token, injects Authorization, and coordinates refresh/retry.
- **Bearer-capable SSE client**: Fetch-stream replacement for `EventSource` in native bearer mode.
- **Attach-token wiring**: REST minting of short-lived single-use WebSocket attach tokens before browser `WebSocket` creation.
- **Route manifest**: Deterministic shell-owned aggregate of feature routes, route metadata, navigation entries, and auth/capability requirements.
- **DeepLinkIntent**: Parsed OAuth2, email-confirmation, password-reset, or route-restoration link that directs the shell without leaking tokens.

## Dependencies

- `specs/014-backend-gaps-program/`: OAuth2 AS/JWKS, native PKCE public client registration, refresh-token rotation/reuse detection, JWT validation, CORS, SSE auth, attach-token backend, and owner isolation.
- `specs/015-verified-route-tables/`: verified auth routes for email confirmation, password reset, current password flows, and admin route families.
- `specs/017-shared-auth-client-capability/`: app-owned auth transport and `ApiClientPort`.
- `specs/018-native-networking-origins/`: runtime origins, bearer mode transport policy, fetch-SSE requirement, and attach-token URL construction.
- `specs/022-route-shell-foundation/`: feature route module discovery and route/navigation manifest ownership.
- `specs/020-build-release-native-e2e/`: native platform floors, release signing policy, and native e2e coverage.

## Non-Goals

- Implementing backend OAuth2 AS/JWKS, refresh-token reuse detection, attach-token backend, JWT validation, CORS, or owner-isolation changes.
- Replacing browser Web Platform transports with native HTTP plugins.
- Implementing account, admin, signup, email-confirmation, or password-reset feature screens beyond the deep-link intent and shell routing contract.
- Selecting a specific secure-storage or biometric plugin without implementation-time audit of platform behavior and maintenance status.
- Extracting shared feature packages or creating a new composed app unless a separate approved extraction milestone lands.

## Success Criteria

- **SC-001**: Native login, callback handling, refresh, and logout are specified as Authorization Code + PKCE with rotating refresh tokens in Keychain/Keystore-backed storage and access tokens kept memory-first.
- **SC-002**: Web mode is explicitly preserved as cookie/CSRF with `credentials: 'include'`, `XSRF-TOKEN`, and `X-XSRF-TOKEN`.
- **SC-003**: Native bearer transports include token-injecting fetch, fetch-based SSE, and WebSocket attach-token minting without long-lived bearer material in URLs.
- **SC-004**: Router guards restore auth before protected-route decisions and consume a frozen auth/session contract.
- **SC-005**: The app shell and route manifest APIs are frozen so feature slices register routes/navigation without editing shared router, guard, auth-store, or shell internals.
- **SC-006**: Secure-storage, biometric unlock, token rotation, refresh failure, logout revocation, cookie clearing, and deep-link token handling have explicit tests and fail-closed behavior.
