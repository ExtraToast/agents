# Feature Specification: Native Target ADR

**Feature Branch**: `013-native-target-adr`
**Created**: 2026-06-16
**Status**: Accepted
**Input**: Decide the native mobile target, reuse strategy, and transport rules for a cross-platform Vue app that preserves agents-ui parity and grafts account/auth/admin/signup flows.

## Decision

Use **Capacitor 7** as the native target for the accounts + agents mobile app.

The default implementation path is to **Capacitorize `services/agents-ui` in place** and graft the existing auth-ui auth, account, admin, and signup flows into that app shell. The alternative, **extract shared feature packages first and compose `services/accounts-agents-app`**, is deferred unless feature extraction lands as its own explicit milestone before native scaffold work begins.

Transport stays on browser Web Platform APIs: **`fetch`, `EventSource`, and `WebSocket` with backend CORS allow-list entries for `capacitor://localhost` and `http://localhost`**. Do not use native HTTP plugins for primary API calls or streams. WebSocket attach uses a **short-lived, single-use, replay-protected attach-token obtained through authenticated REST**.

`specs/012-mobile-usability/spec.md` is prior art: the native app inherits its phone usability requirements for touch targets, safe areas, dynamic viewport handling, terminal usability, and no desktop regressions.

## Decision Matrix

| Candidate | Fits verified agents-ui parity? | Reuse cost | Mobile maturity | Decision |
| --- | --- | --- | --- | --- |
| Capacitor 7 | Yes. Hosts the existing Vue DOM app, xterm, PrimeVue, Tailwind, browser streaming, SSE, and WebSocket stack in a system WebView. | Lowest. Adds native shells around `services/agents-ui` and preserves feature code. | Mature mobile bridge, Android/iOS project generation, established plugin ecosystem. | Accepted |
| NativeScript-Vue | No. Its native-widget renderer cannot directly host the existing DOM-dependent xterm terminal, `@xterm/addon-webgl`, PrimeVue component tree, or Tailwind DOM/CSS assumptions. | Highest. Would require rewriting UI to native widgets or embedding a WebView island that recreates Capacitor with more integration risk. | Mature enough for native UI apps, but not for preserving this web UI parity. | Rejected |
| Ionic Vue | Partial. Ionic Vue is a UI/component layer that can run inside Capacitor, but it does not replace the native target decision. | Medium to high if used as the app shell because PrimeVue/vue-web-commons components already define the shell and feature UI. | Mature for mobile gestures and controls when paired with Capacitor. | Rejected as target; allowed only for selective gesture grafting |
| Tauri 2 Mobile | Partial. It can host a WebView, but mobile support and plugin/CI conventions are less proven for this app's Android/iOS parity needs. | Medium. Preserves web UI but adds Rust/mobile operational surface without a compensating parity advantage. | Immature relative to Capacitor for mobile delivery. | Rejected |

## Verified Parity Anchors

- `services/agents-ui/package.json` pins `@xterm/xterm` `6.0.0`, `@xterm/addon-webgl` `0.19.0`, PrimeVue `^4.5.5`, and Tailwind `^4.3.0`.
- `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` constructs the xterm `Terminal`, loads `WebglAddon`, falls back to DOM rendering on WebGL failure, and depends on browser clipboard, resize, focus, visibility, and touch behavior.
- `services/agents-ui/src/features/sessions/services/chatSessionsService.ts` streams chat with browser `fetch`, `credentials: 'include'`, and `ReadableStream.getReader()`.
- `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` opens browser `EventSource` at `/api/v1/sessions/events` with `withCredentials: true`.
- `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` uses browser `WebSocket` for `/api/v1/ws/sessions/{id}/attach`, reconnects with epoch/offset replay state, and currently derives the host from `window.location.host`.
- `services/agents-ui/src/lib/vueWebCommons.ts` and `services/agents-ui/src/router/index.ts` show the current web auth integration: cookie/CSRF auth, `/api/v1` same-origin assumptions for agents, and redirects to auth-ui through `VITE_AUTH_URL`.

## Rejection Rationale

### NativeScript-Vue

NativeScript-Vue is rejected because the required UI is already a browser DOM application. The terminal depends on xterm's DOM/canvas/WebGL renderers, the chat path depends on browser streaming, the status path depends on `EventSource`, and the UI stack depends on PrimeVue 4 and Tailwind 4. Rebuilding those features as NativeScript native widgets would discard the verified agents-ui parity surface. Embedding a WebView inside NativeScript would preserve the DOM but would duplicate Capacitor's core value while increasing integration risk.

### Ionic Vue

Ionic Vue is rejected as the native target because it is not the native shell. The project already has PrimeVue, Tailwind, vue-web-commons shell primitives, and mobile usability requirements from `specs/012-mobile-usability/spec.md`. Replacing the component stack with Ionic would expand scope and risk parity regressions. Selective Ionic gesture or control grafting is allowed later only when it is isolated, tested, and does not replace the PrimeVue/Tailwind shell.

### Tauri 2 Mobile

Tauri 2 Mobile is rejected because the app needs predictable Android/iOS delivery around a WebView-hosted Vue app, not a new Rust/mobile operational surface. It has no parity advantage over Capacitor for xterm, PrimeVue, Tailwind, `fetch`, `EventSource`, or `WebSocket`, and its mobile ecosystem is less mature for this use case.

## Reuse Sub-Decision

### Default: Capacitorize `agents-ui` In Place

The default path is:

1. Add Capacitor 7 to `services/agents-ui`.
2. Keep agents-ui feature code as the canonical implementation for sessions, workspaces, repositories, projects, terminal, chat, SSE, and WebSocket behavior.
3. Graft auth-ui auth/account/admin/signup flows into the same shell after route and contract verification. The auth-ui source is not present in this checkout; do not invent local auth-ui paths when planning implementation.
4. Add native-only platform abstractions behind browser-compatible interfaces so the web build remains the same product surface.

This path minimizes parity risk because the highest-risk feature, the live terminal, stays in its verified DOM/WebGL environment.

### Deferred Alternative: Extract Then Compose

Extracting shared feature packages first and composing a new `services/accounts-agents-app` is allowed only if extraction lands as an explicit milestone before native scaffold work. That milestone must define package ownership, route registration, auth transport boundaries, contract generation, dependency pinning, and CI gates. Without that milestone, a new composed app would create a second integration surface before parity is secured.

## Transport Decisions

### TD-001: Use Browser Transports, Not Native HTTP

The app MUST use browser `fetch`, browser `EventSource`, and browser `WebSocket` as the primary transport APIs on web and under Capacitor. Native HTTP plugins MUST NOT be used for normal REST calls, chat streaming, SSE, or terminal attach.

Backends MUST allow the native WebView origins needed by Capacitor and local development:

- `capacitor://localhost`
- `http://localhost`

The CORS policy MUST cover authenticated REST, chat streaming, SSE, and WebSocket upgrade paths without broad wildcard origins.

### TD-002: Use REST-Minted WebSocket Attach Tokens

The terminal attach socket MUST NOT rely on guessed session UUIDs, spoofable user headers, or long-lived bearer material in the WebSocket URL. Before opening the socket, the client obtains a short-lived attach-token through an authenticated REST call.

The attach-token MUST be:

- scoped to the authenticated user and target session;
- single-use;
- short-lived;
- bound to a nonce or server-side replay record;
- rejected after first successful consume;
- rejected when expired, replayed, mismatched to the session/user, or used from a disallowed origin.

The WebSocket attach endpoint then consumes the token during handshake and continues using the existing browser `WebSocket` framing semantics.

## Requirements

### Functional Requirements

- **FR-001**: The native target MUST be Capacitor 7 wrapping the Vue DOM application.
- **FR-002**: The app MUST preserve the verified agents-ui parity anchors listed above.
- **FR-003**: The app MUST use `services/agents-ui` as the default native scaffold location.
- **FR-004**: Auth, account, admin, and signup flows MUST be grafted into the Capacitorized app only after their routes/contracts are verified.
- **FR-005**: NativeScript-Vue, Ionic Vue as the target shell, and Tauri 2 Mobile MUST NOT be used for the initial native target.
- **FR-006**: Ionic Vue MAY be used later only for isolated gesture/control grafting that does not replace the PrimeVue/Tailwind shell.
- **FR-007**: REST, chat streaming, SSE, and WS attach MUST use browser Web Platform transports under Capacitor.
- **FR-008**: Backends MUST use explicit CORS allow-list entries for `capacitor://localhost` and `http://localhost`.
- **FR-009**: WS attach MUST require an authenticated REST-minted, short-lived, single-use, replay-protected attach-token.
- **FR-010**: The implementation plan MUST treat `specs/012-mobile-usability/spec.md` as baseline mobile UX acceptance.

### Key Entities

- **Native target**: Capacitor 7 shell around the Vue DOM app.
- **Reusable app surface**: Existing agents-ui feature modules and grafted auth/account/admin/signup flows.
- **Runtime transport**: Browser `fetch`, `EventSource`, and `WebSocket` configured for explicit runtime origins.
- **WS attach-token**: Short-lived single-use credential minted by authenticated REST and consumed by the WS handshake.

## Dependencies

- `specs/012-mobile-usability/spec.md`: baseline phone usability prior art.
- Backend CORS work must allow `capacitor://localhost` and `http://localhost` without wildcard origins.
- Backend WS handshake work must validate and consume attach-tokens.
- Auth client work must resolve cookie/CSRF web mode versus native bearer mode without forcing native HTTP.
- Native networking work must replace same-origin URL assumptions such as `/api/v1` and `window.location.host` backend discovery with explicit runtime origins.
- Auth-ui flow grafting depends on verified auth/account/admin/signup route tables and contracts.

## Success Criteria

- **SC-001**: The ADR clearly accepts Capacitor 7 and rejects NativeScript-Vue, Ionic Vue as target shell, and Tauri 2 Mobile with parity-grounded rationale.
- **SC-002**: The ADR records the default reuse path and the only allowed condition for the extract-then-compose alternative.
- **SC-003**: The ADR records both transport decisions, including CORS origins and WS attach-token properties.
- **SC-004**: Downstream specs can implement scaffold, auth, networking, contracts, and release policy without reopening the native-target decision.
