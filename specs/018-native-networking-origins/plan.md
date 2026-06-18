# Implementation Plan: Native Networking and Origins

**Branch**: `018-native-networking-origins` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-native-networking-origins/spec.md`

## Summary

Replace agents-ui same-origin networking assumptions with an explicit runtime-origin layer. The implementation adds typed `RuntimeOrigins`, central `UrlBuilder` helpers, and a `CredentialsModePolicy` that supports today's web cookie/CSRF mode and native bearer mode. Feature services consume absolute URLs from that layer for agents REST, session status SSE/fetch-SSE, chat streaming, and WebSocket attach. Static tests prevent new feature-owned `'/api/v1'` literals and backend host discovery through `window.location.host`.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x, Kotlin backend contracts referenced only
**Primary Dependencies**: Vite env variables, `@extratoast/vue-web-commons`, browser `fetch`, `EventSource`, `WebSocket`, Vitest
**Storage**: N/A for this feature; bearer token storage is owned by native auth work
**Testing**: `pnpm --filter @extratoast/agents-ui typecheck`, `pnpm --filter @extratoast/agents-ui lint`, `pnpm --filter @extratoast/agents-ui test`
**Target Platform**: Existing web build plus Capacitor WebView served from `capacitor://localhost`
**Project Type**: Client UI/networking contract slice with backend security dependencies
**Performance Goals**: URL building and policy lookup must be synchronous and negligible; streaming behavior must preserve existing chat/status/terminal responsiveness
**Constraints**: Do not use native HTTP plugins; do not send `X-User-Id`; do not infer backend origins from the current page; do not change generated OpenAPI path strings
**Scale/Scope**: One agents-ui networking layer plus focused service rewrites and static regression tests

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Claude/Codex parity is not changed by this client networking plan
- [x] Rendered artifacts are not touched by this spec
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification command is identified for the touched area

## Verified Current-State Anchors

| Area | Verified path | Current assumption |
| --- | --- | --- |
| Common agents API base | `services/agents-ui/src/lib/vueWebCommons.ts` | `baseUrl: '/api/v1'` |
| Auth base | `services/agents-ui/src/lib/vueWebCommons.ts` | `VITE_AUTH_URL ?? 'http://localhost:5174'` |
| Status stream | `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` | `EventSource('/api/v1/sessions/events', { withCredentials: true })` |
| Chat stream | `services/agents-ui/src/features/sessions/services/chatSessionsService.ts` | Raw `fetch('/api/v1/chat-sessions/{id}/messages/stream', { credentials: 'include' })` |
| Terminal WebSocket | `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` | `window.location.host.replace(/^agents\./, 'agents-ws.')` |
| Client tests | `services/agents-ui/src/features/workspaces/__tests__/sessionStatusStream.test.ts`, `sessionSocket.test.ts` | Assert relative `/api/v1` paths today |
| Static guard gap | `services/agents-ui/.dependency-cruiser.cjs`, `services/agents-ui/vitest.config.ts` | No rule forbids feature-owned `/api/v1` or backend host discovery |

## Project Structure

### Documentation

```text
specs/018-native-networking-origins/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Source Code Targets

```text
services/agents-ui/env.d.ts
services/agents-ui/src/lib/runtimeOrigins.ts
services/agents-ui/src/lib/vueWebCommons.ts
services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts
services/agents-ui/src/features/workspaces/services/sessionSocket.ts
services/agents-ui/src/features/sessions/services/chatSessionsService.ts
services/agents-ui/src/features/workspaces/services/workspaceService.ts
services/agents-ui/src/features/projects/services/projectsService.ts
services/agents-ui/src/features/repositories/services/repositoriesService.ts
services/agents-ui/src/features/workspaces/components/OpenPrButton.vue
services/agents-ui/src/features/workspaces/__tests__/sessionStatusStream.test.ts
services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts
services/agents-ui/src/features/sessions/__tests__/
services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts
services/agents-ui/src/__tests__/nativeNetworkingStatic.test.ts
```

**Structure Decision**: Put the origin and URL policy in `services/agents-ui/src/lib/runtimeOrigins.ts` next to `vueWebCommons.ts`, because existing feature services already import common web/auth helpers from `@/lib/vueWebCommons`. Do not create a second generated API client or move generated OpenAPI files.

## Runtime Design

### RuntimeOrigins

Use branded string types or equivalent narrow types:

```text
type AuthOrigin = string
type AgentsApiOrigin = string
type AgentsWsOrigin = string

interface RuntimeOrigins {
  auth: AuthOrigin
  agentsApi: AgentsApiOrigin
  agentsWs: AgentsWsOrigin
}
```

Environment keys:

```text
VITE_AUTH_ORIGIN
VITE_AGENTS_API_ORIGIN
VITE_AGENTS_WS_ORIGIN
VITE_AUTH_URL          # accepted as a temporary alias for existing web deployments
```

Parsing rules:

- HTTP(S) only for `AuthOrigin` and `AgentsApiOrigin`.
- WS(S) only for `AgentsWsOrigin`.
- Reject blank values, relative values, paths, queries, hashes, and non-origin schemes.
- Normalize trailing slash away.
- Development/test defaults may mirror verified local config: auth/UI origin `http://localhost:5174`, agents API through the Vite `/api` proxy at `http://localhost:5174` or direct agents-api at `http://localhost:8082`, and WS direct to `ws://localhost:8082` only when `import.meta.env.DEV` or test stubs opt in.
- Production/native builds must fail closed on missing required origins.

### UrlBuilder

Central helpers:

```text
authMeUrl(): string
agentsApiBaseUrl(): string
agentsApiUrl(path: string, query?: URLSearchParams): string
sessionsEventsUrl(): string
chatMessageStreamUrl(chatSessionId: string): string
sessionAttachWsUrl(sessionId: string, cursor?: { epoch: number; offset: number }, attachToken?: string): string
```

Rules:

- `UrlBuilder` owns `/api/v1` appending for agents endpoints.
- Feature-owned services pass path fragments without `/api/v1`.
- Dynamic IDs must be encoded with `encodeURIComponent`.
- WS attach preserves the existing epoch/offset reconnect query semantics and adds attach-token support when backend G3 is available.

### CredentialsModePolicy

Modes:

| Mode | REST and chat stream | Status stream | WebSocket attach |
| --- | --- | --- | --- |
| `web-cookie` | `credentials: 'include'`, CSRF header when token exists, no `Authorization`, no `X-User-Id` | Standard `EventSource` may use `withCredentials: true` against `sessionsEventsUrl()` | Mint attach-token with cookie credentials, then open WS URL with attach-token and cursor query |
| `native-bearer` | `credentials: 'omit'`, `Authorization: Bearer <token>`, `Content-Type` as needed, no CSRF, no `X-User-Id` | Use fetch-based SSE parser so `Authorization` can be sent | Mint attach-token with bearer REST call, then open WS URL with attach-token and cursor query |

Implementation should expose small helpers rather than duplicating request options in feature services:

```text
restRequestInit(base?: RequestInit): RequestInit
streamRequestInit(base?: RequestInit): RequestInit
eventSourceInit(): EventSourceInit | null
requiresFetchSse(): boolean
```

Token acquisition and secure native storage are outside this feature; this layer consumes a token provider interface from the native auth work when bearer mode is enabled.

## Trust Boundary and Backend Contract

Today's web path is trusted only because the browser calls through same-origin Traefik forward-auth. The browser does not get to choose identity; the edge authenticates the session and injects `X-User-Id` before forwarding to `agents-api`.

Native absolute-origin access must use one of these server-validated paths:

1. A bearer-aware edge validates `Authorization: Bearer <token>` and only then injects trusted identity to `agents-api`.
2. `agents-api` validates the JWT itself and derives a trusted principal.

The client must never send `X-User-Id` directly. If backend work has not landed, native bearer mode remains blocked rather than emulating the header.

CORS/Origin requirements for backend work:

- Allow exact native/local origins needed by the app: `capacitor://localhost` and `http://localhost` for the configured local ports.
- Cover REST, auth/account/admin APIs, chat stream, status SSE/fetch-SSE, attach-token mint, and WebSocket handshake.
- Allow `Authorization`, `Content-Type`, and `X-XSRF-TOKEN` headers where applicable.
- Use `Access-Control-Allow-Credentials: true` only with explicit origins; never combine credentials with wildcard origins.
- Replace WebSocket wildcard origins with the same explicit policy.

## Phase 0: Evidence and Contract Alignment

1. Verify all existing same-origin assumptions listed above.
2. Confirm generated OpenAPI files legitimately contain `/api/v1` paths and must be excluded from static literal guards.
3. Align with `specs/014-backend-gaps-program/` so this client work blocks native bearer release until JWT/CORS/attach-token backend milestones land.

**Output**: Evidence and dependencies embedded in [spec.md](./spec.md) and this plan.

## Phase 1: Origin Layer Design

1. Add `runtimeOrigins.ts` with origin parsing, `RuntimeOrigins`, `UrlBuilder`, and `CredentialsModePolicy`.
2. Add TypeScript env declarations in `env.d.ts`.
3. Add unit tests for parsing, defaults, URL joining, ID encoding, cursor query behavior, and credential policy.

**Output**: Runtime origin primitives with passing focused Vitest tests.

## Phase 2: Service Migration

1. Update `vueWebCommons.ts` to use runtime origins and the credentials policy.
2. Replace status stream, chat stream, and WebSocket URL construction with `UrlBuilder`.
3. Replace feature service `baseUrl: '/api/v1'` overrides with the central agents API base or no override where the common helper already supplies it.
4. Preserve existing response parsing, reconnect, heartbeat, queueing, CSRF, and stream frame behavior.

**Output**: Feature services no longer own backend origin/path literals.

## Phase 3: Static Regression Gates

1. Add `nativeNetworkingStatic.test.ts` or an equivalent lint/test gate that scans feature-owned source.
2. Fail on hard-coded `'/api/v1'`, ``/api/v1``, client-sent `X-User-Id`, and `window.location.host` or host/protocol backend discovery outside the runtime-origin module.
3. Exclude generated OpenAPI output, e2e route mocks, fixture assertions, docs, and the central URL builder's intentional `/api/v1` constant.

**Output**: Static guard that protects future feature slices.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Evidence complete for spec planning
- [ ] Phase 1: Origin layer design complete
- [ ] Phase 2: Service migration complete
- [ ] Phase 3: Static regression gates complete

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS for this documentation slice
- [x] All NEEDS CLARIFICATION resolved

## Verification

Documentation verification for this task:

```bash
test -f specs/018-native-networking-origins/spec.md \
  && test -f specs/018-native-networking-origins/plan.md \
  && test -f specs/018-native-networking-origins/tasks.md \
  && grep -q RuntimeOrigins specs/018-native-networking-origins/spec.md \
  && grep -q UrlBuilder specs/018-native-networking-origins/spec.md \
  && grep -q CredentialsModePolicy specs/018-native-networking-origins/spec.md \
  && grep -q capacitor://localhost specs/018-native-networking-origins/spec.md \
  && grep -q X-User-Id specs/018-native-networking-origins/spec.md
```

Implementation verification after downstream code changes:

```bash
pnpm --filter @extratoast/agents-ui typecheck \
  && pnpm --filter @extratoast/agents-ui lint \
  && pnpm --filter @extratoast/agents-ui test
```
