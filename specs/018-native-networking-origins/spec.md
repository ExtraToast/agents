# Feature Specification: Native Networking and Origins

**Feature Branch**: `018-native-networking-origins`
**Created**: 2026-06-16
**Status**: Draft
**Input**: Define the env-driven absolute API/WS origin layer that replaces same-origin assumptions before Capacitor native networking work depends on REST, SSE, chat streaming, or terminal attach.

## Scope

This feature defines the client origin and credentials layer used by the native accounts + agents app and the existing web build. It is a client contract and implementation slice, not the backend security implementation itself. Backend JWT, CORS, attach-token, and owner-isolation prerequisites remain owned by `specs/014-backend-gaps-program/`.

Verified current-state anchors in this checkout:

- `services/agents-ui/src/lib/vueWebCommons.ts` uses `baseUrl: '/api/v1'` for agents API calls and `VITE_AUTH_URL` for auth.
- `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` opens `EventSource('/api/v1/sessions/events', { withCredentials: true })`.
- `services/agents-ui/src/features/sessions/services/chatSessionsService.ts` posts the chat stream to ``/api/v1/chat-sessions/${id}/messages/stream`` with `credentials: 'include'`.
- `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` derives the WS host from `window.location.host.replace(/^agents\./, 'agents-ws.')`, which is invalid under `capacitor://localhost`.
- `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/SecurityConfig.kt` registers `XUserIdFilter`, which only checks that `X-User-Id` is present and non-blank.
- `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/WebSocketConfig.kt` currently allows `setAllowedOriginPatterns("*")`.
- `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/SessionStatusController.kt` reads `@RequestHeader("X-User-Id")` for `GET /api/v1/sessions/events`.
- `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/ChatSessionController.kt` hides `POST /api/v1/chat-sessions/{id}/messages/stream` from OpenAPI and streams it through a hand-written client path.

## User Scenarios & Testing

### User Story 1 - Resolve Absolute Runtime Origins (Priority: P1)

The app resolves auth, agents REST/SSE/chat, and agents WebSocket endpoints from explicit runtime environment origins rather than from same-origin paths or the current page host.

**Why this priority**: Capacitor serves the app from `capacitor://localhost`; relative `/api/v1` URLs and `window.location.host` discovery cannot identify the production backends from that origin.

**Independent Test**: Unit tests stub runtime env values and assert that REST, SSE, chat stream, and WebSocket URLs are absolute and never depend on `window.location.host`.

**Acceptance Scenarios**:

1. **Given** `VITE_AUTH_ORIGIN=https://auth.example`, `VITE_AGENTS_API_ORIGIN=https://agents.example`, and `VITE_AGENTS_WS_ORIGIN=wss://agents-ws.example`, **When** the app builds URLs, **Then** auth, REST/SSE/chat, and WS attach URLs use those exact origins with `/api/v1` appended only by the central URL builder.
2. **Given** the app runs under `capacitor://localhost`, **When** a terminal attach URL is created, **Then** the WS origin comes from `VITE_AGENTS_WS_ORIGIN` and no `capacitor://` host rewrite is attempted.
3. **Given** a configured origin includes a trailing slash or a path-like value, **When** runtime origins are parsed, **Then** the parser normalizes a trailing slash and rejects values that are not valid absolute origins.

---

### User Story 2 - Apply Credentials by Transport Mode (Priority: P1)

The app applies credentials consistently for web cookie/CSRF mode and native bearer mode across generated API calls, raw fetch streams, SSE, and WebSocket attach.

**Why this priority**: Native WebView requests cannot safely emulate the current same-origin cookie path by sending a spoofable identity header. Each transport must know whether it is using browser credentials or an Authorization bearer.

**Independent Test**: Tests cover `CredentialsModePolicy` for REST, chat streaming, SSE, and WS attach in both cookie and bearer modes.

**Acceptance Scenarios**:

1. **Given** web cookie mode, **When** REST and chat stream requests are sent, **Then** they use `credentials: 'include'`, the existing CSRF token source, and no client-supplied `X-User-Id`.
2. **Given** native bearer mode, **When** REST and chat stream requests are sent, **Then** they send `Authorization: Bearer <token>`, avoid cookie credentials, and never send `X-User-Id`.
3. **Given** native bearer mode needs session status streaming, **When** the status stream opens, **Then** it uses a fetch-based SSE parser or an equivalent bearer-capable stream path rather than standard `EventSource` without headers.
4. **Given** terminal attach in either mode, **When** the socket opens, **Then** the client obtains a short-lived attach-token through authenticated REST and places only that token plus replay cursor parameters in the WebSocket URL.

---

### User Story 3 - Preserve the Trusted Edge/Auth Boundary (Priority: P1)

The app documents and enforces the trust model difference between today's web same-origin deployment and native absolute-origin access.

**Why this priority**: The current web deployment relies on Traefik forward-auth injecting `X-User-Id` before the request reaches `agents-api`. A native app must not send that spoofable header directly to `agents-api`.

**Independent Test**: Static tests fail if feature-owned client code contains `X-User-Id`, hard-coded `'/api/v1'` backend literals, or backend discovery through `window.location.host`.

**Acceptance Scenarios**:

1. **Given** the current web deployment, **When** a browser calls same-origin agents endpoints, **Then** Traefik forward-auth authenticates the user and injects `X-User-Id` before forwarding to `agents-api`.
2. **Given** native absolute-origin access, **When** the app calls agents endpoints, **Then** identity is established by either a bearer-aware edge that validates the token before injecting a trusted header or by `agents-api` validating the JWT itself.
3. **Given** any client runtime mode, **When** the app builds requests, **Then** it never sets `X-User-Id` from client code.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST define `RuntimeOrigins` with `AuthOrigin`, `AgentsApiOrigin`, and `AgentsWsOrigin`.
- **FR-002**: `AuthOrigin` and `AgentsApiOrigin` MUST be absolute HTTP(S) origins with no path, query, or hash.
- **FR-003**: `AgentsWsOrigin` MUST be an absolute WS(S) origin with no path, query, or hash.
- **FR-004**: Runtime origin values MUST come from explicit environment configuration, with local development defaults allowed only for development/test mode.
- **FR-005**: The app MUST provide a central `UrlBuilder` that constructs all auth, REST, SSE, chat stream, and WebSocket attach URLs from `RuntimeOrigins`.
- **FR-006**: The `UrlBuilder` MUST be the only place in feature-owned client code that appends `/api/v1`.
- **FR-007**: Feature-owned services MUST NOT contain hard-coded `'/api/v1'` or ``/api/v1`` backend URL literals after this feature lands.
- **FR-008**: Feature-owned code MUST NOT discover backend hosts from `window.location.host`, `window.location.hostname`, or `window.location.protocol`.
- **FR-009**: `vueWebCommons.ts` MUST use the configured `AgentsApiOrigin` for the default agents API base URL and the configured `AuthOrigin` for auth endpoints.
- **FR-010**: `sessionStatusStream.ts` MUST build the status stream URL from `UrlBuilder.sessionsEventsUrl()`.
- **FR-011**: `chatSessionsService.ts` MUST build `POST /api/v1/chat-sessions/{id}/messages/stream` from `UrlBuilder.chatMessageStreamUrl(id)`.
- **FR-012**: `sessionSocket.ts` MUST build `/api/v1/ws/sessions/{sessionId}/attach` from `AgentsWsOrigin` and MUST preserve existing epoch/offset reconnect query behavior.
- **FR-013**: The app MUST define `CredentialsModePolicy` for at least `web-cookie` and `native-bearer` modes.
- **FR-014**: Web cookie mode MUST continue to use `credentials: 'include'`, the existing CSRF token behavior, and browser cookies where the deployment supports them.
- **FR-015**: Native bearer mode MUST use `Authorization: Bearer <access-token>` for REST and fetch-based streams, avoid cookie credentials, and never send client-generated identity headers.
- **FR-016**: Standard `EventSource` MAY be used only in a credentials mode where the required auth material is carried by browser-managed credentials. Bearer mode MUST use a bearer-capable SSE implementation.
- **FR-017**: WebSocket attach MUST use a REST-minted short-lived single-use attach-token; long-lived bearer tokens and spoofable identity headers MUST NOT be placed in the WS URL.
- **FR-018**: Backend CORS requirements MUST explicitly include `capacitor://localhost` and `http://localhost` for REST, chat stream, SSE, and WebSocket handshake paths without wildcard origins.
- **FR-019**: CORS policy MUST allow `Authorization`, `Content-Type`, and `X-XSRF-TOKEN` where applicable and MUST use `Access-Control-Allow-Credentials: true` only with explicit allowed origins.
- **FR-020**: Static tests MUST fail on feature-owned `'/api/v1'` literals and `window.location.host` backend discovery while excluding generated OpenAPI types and intentional test fixtures.
- **FR-021**: Client code MUST NOT set `X-User-Id`; identity must come from a validated bearer-aware edge or from `agents-api` JWT verification as specified by `specs/014-backend-gaps-program/`.

### Key Entities

- **RuntimeOrigins**: Parsed, validated runtime configuration containing `auth`, `agentsApi`, and `agentsWs` origins.
- **AuthOrigin**: HTTP(S) origin for auth/account/admin/signup APIs and auth redirects.
- **AgentsApiOrigin**: HTTP(S) origin for agents REST, SSE, and fetch-based chat stream requests.
- **AgentsWsOrigin**: WS(S) origin for terminal WebSocket attach requests.
- **UrlBuilder**: Central URL construction API for `/api/v1` paths and auth paths. It owns path joining, path encoding, query parameters, and origin normalization.
- **CredentialsModePolicy**: Runtime policy that maps transport type to credentials behavior, headers, CSRF usage, and bearer-token requirements.
- **Web Cookie Mode**: Browser deployment mode that relies on same-origin or CORS-enabled cookies, CSRF token source, and the trusted edge to inject server-side identity.
- **Native Bearer Mode**: Capacitor deployment mode that sends validated OAuth2/JWT access tokens through bearer-capable transports.
- **Trusted Edge Boundary**: Traefik forward-auth or equivalent edge component that validates auth material and injects trusted identity headers only after validation.

## Edge Cases

- Capacitor's `capacitor://localhost` origin has no useful backend host, so any fallback to `window.location.host` must fail tests.
- Local web development may run from `http://localhost` with varying ports; origin parsing must allow the configured port and backend CORS must allow the exact expected local origins.
- Standard `EventSource` cannot set custom Authorization headers. Bearer mode must not silently open an unauthenticated status stream.
- WebSocket browser APIs cannot set arbitrary Authorization headers. Attach-token minting is required before socket creation.
- Trailing slashes in environment origins must not produce double slashes in endpoint URLs.
- Path traversal, blank session IDs, and unencoded identifiers must not be accepted by URL helpers.
- Generated OpenAPI files may contain `/api/v1` paths and must be excluded from feature-owned static literal tests.
- Browser redirect URLs may use `window.location.href` for front-end navigation, but not for backend host discovery.

## Dependencies

- `specs/013-native-target-adr/`: accepts Capacitor 7, browser `fetch`/SSE/WS transports, and native CORS origins.
- `specs/014-backend-gaps-program/`: owns JWT/JWKS validation, attach-token handshake security, CORS allow-lists, and owner isolation.
- Contract work must keep generated OpenAPI path strings separate from runtime URL construction.

## Success Criteria

- **SC-001**: Unit tests prove `RuntimeOrigins` rejects non-origin values and builds absolute REST, SSE, chat stream, and WS attach URLs for web and native inputs.
- **SC-002**: `vueWebCommons.ts`, `sessionStatusStream.ts`, `chatSessionsService.ts`, and `sessionSocket.ts` no longer hard-code feature-owned `'/api/v1'` backend URLs.
- **SC-003**: `sessionSocket.ts` no longer uses `window.location.host` or the `agents.` to `agents-ws.` rewrite.
- **SC-004**: Static tests fail when feature-owned source introduces a new `'/api/v1'` backend literal, `window.location.host` backend discovery, or client-sent `X-User-Id`.
- **SC-005**: The spec and implementation tasks clearly state that native clients authenticate through bearer-aware edge validation or direct `agents-api` JWT verification, never by sending a spoofable `X-User-Id`.
