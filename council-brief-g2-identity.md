# Brief: Design the trusted-identity model for agents-api (backend gap G2)

## Goal

Design (NOT implement) how agents-api obtains a **server-trusted user identity**
so that a spoofed `X-User-Id` from a direct (edge-bypassing) caller is rejected,
WHILE (a) the existing web UI keeps working and (b) native Capacitor clients can
authenticate with an OAuth2 bearer. Also define how the resulting principal is
consumed by the dependent gaps G3 (WS attach-token), G4 (SSE auth), G5 (chat
ownership), G7 (per-owner isolation). Produce a cross-critiqued design + a
concrete implementation task list (which change lands in which repo) + reconcile
it with `specs/027-agents-auth-edge-rbac` and `specs/014-backend-gaps-program`.

## Verified current state (do not re-derive; planners cannot read personal-stack)

### agents-api (`/workspace/agents/services/agents-api`)
- **No Spring Security, no JWT.** `config/SecurityConfig.kt` registers plain
  servlet filters:
  - `XUserIdFilter` (order 1, urlPatterns `/api/*`): rejects only a
    blank/missing `X-User-Id` header — **no validation**. `shouldNotFilter`
    skips `/api/actuator`, `/api/v1/health`, `/api/v1/api-docs`,
    `/api/v1/swagger-ui`, `/api/v1/internal/`.
  - `InternalBearerAuthFilter` (order 0, `/api/v1/internal/*`): constant-time
    shared-bearer check against `AgentRuntimeProperties.githubAppTokenBearer`;
    fail-closed.
- Controllers read identity via `@RequestHeader("X-User-Id") userId: String`
  (e.g. `infrastructure/web/ChatSessionController.kt:41,62,125`). Some chat
  endpoints (`get`, `appendMessage`, `streamMessage` — lines 69,82,109) take NO
  user header and do NO access check (these are G5's problem).
- WS: `infrastructure/ws/WebSocketConfig.kt` registers
  `/api/v1/ws/sessions/*/attach` with `setAllowedOriginPatterns("*")`;
  `SessionAttachHandler` bridges to the gateway resolving only the URL
  `sessionId` with no owner check (G3's problem).
- SSE: `application/sessionstatus/SessionStatusBroadcaster.kt` +
  `application/chat/ChatAnswerStreamService.kt` emit `SseEmitter`s; the events
  endpoint is unauthenticated/`@Hidden` (G4's problem).

### The edge (personal-stack, verified)
- Traefik **forward-auth Middleware** (`platform/cluster/flux/apps/edge/
  traefik-forward-auth-middleware.yaml`): `address:
  http://auth-api.auth-system.svc.cluster.local:8081/api/v1/auth/verify`,
  `authResponseHeaders: [X-User-Id]` — i.e. only `X-User-Id` is copied upstream.
- `auth-api` `AuthVerificationController` `/api/v1/auth/verify`: validates the
  **session cookie**, returns 403 if invalid, else 200 with response headers
  `X-User-Id` and `X-User-Roles`.
- So the WEB path is: browser → Traefik (forward-auth validates session via
  /verify) → injects `X-User-Id` → agents-api trusts it. A caller hitting
  agents-api directly in-cluster can forge `X-User-Id`. THIS is the vuln.
- `agents.*` is exposed through this edge; a separate `agents-api-ws` backend
  exists (Enschede-pinned) for the websocket host.

### auth-api Authorization Server (verified; G1 just shipped, merged)
- Real OAuth2 AS at `/api/oauth2/{authorize,token,jwks,revoke,introspect}`,
  PKCE public clients incl. a new `app-native` client (G1, PR
  ExtraToast/personal-stack#666, merged). AS access tokens carry `sub`(=userId
  UUID), `roles`, `username`, `email` claims (`jwtTokenCustomizer`). JWKS at
  `/api/oauth2/jwks`. G1 added an `oauth2ResourceServer` JWT chain to auth-api's
  OWN protected REST — agents-api has NO such validation yet.

### agents-ui (web client, `/workspace/agents/services/agents-ui`)
- Calls agents-api same-origin at `baseUrl: '/api/v1'` with
  `credentials: 'include'` (cookie); no bearer is sent to agents-api today.
  On 401 it full-page-redirects to `${VITE_AUTH_URL}/login`.

## The decision to make (evaluate options, cross-critique, recommend ONE)

How does agents-api get a server-trusted principal for BOTH web and native,
such that a forged `X-User-Id` from a direct caller is rejected? Candidate
shapes to weigh (add others if better):

1. **Bearer everywhere + edge forwards a token.** agents-api validates an
   AS-issued JWT via JWKS (`/api/oauth2/jwks`), deriving the principal from
   `sub`/`roles`. The edge forward-auth (or auth-api `/verify`) must put a
   bearer/JWT on the upstream request for the web path (e.g. `/verify` returns a
   short-lived signed JWT header that Traefik copies via `authResponseHeaders`,
   or the edge injects an `Authorization` header). agents-ui native sends the
   bearer directly. `X-User-Id` trust removed.
2. **Signed-header trust.** Keep `X-User-Id` but make it un-forgeable: the edge
   (only the edge) adds a signed/HMACed header (or `/verify` returns a signed
   token) that agents-api verifies; direct callers can't mint it. Native still
   needs bearer validation.
3. **Network-trust + bearer for native.** Treat in-cluster access to agents-api
   as trusted (NetworkPolicy/mesh) so `X-User-Id` from the edge is acceptable,
   and add AS-bearer JWT validation as an ADDITIONAL accepted credential for
   native. (Weakest against in-cluster spoofing; document the residual risk.)
4. **Dual-accept transitional → bearer-everywhere.** Phase 1: agents-api accepts
   a validated AS bearer OR edge `X-User-Id`; Phase 2: edge starts forwarding
   the bearer and `X-User-Id` trust is dropped. Sequence the PRs.

Weigh against: not breaking the live web UI; the in-cluster spoof risk; whether
the change touches the edge (personal-stack `fleet.yaml` / forward-auth
middleware / `/verify`) and agents-ui, not just agents-api; operational
complexity; and how cleanly G3/G4/G5/G7 can read the resulting principal
(servlet filter setting a request attribute / SecurityContext, WS handshake
access to it, SSE auth).

## Deliverables

- A consolidated, cross-critiqued **design decision** (chosen option + rejected
  with rationale), grounded ONLY in the verified facts above.
- The **principal-propagation contract** agents-api exposes internally (how a
  controller / WS handshake / SSE endpoint reads the trusted userId+roles).
- An **implementation task list** broken down by repo (agents-api code,
  personal-stack edge config, agents-ui), each with acceptance criteria. MUST
  include: "a forged `X-User-Id` on a direct request is rejected" and "the web
  UI authenticates end-to-end unchanged for the user".
- Reconciliation notes against `specs/027-agents-auth-edge-rbac` and the G2 entry
  in `specs/014-backend-gaps-program` (correct anything the spec got wrong vs the
  verified facts).
- A note on whether G2 must land as a coordinated multi-repo change or can be a
  safe transitional sequence (and the exact order).

## Constraints

- Design only — no code. Output is the design + task list for later codex
  implementation (codex-only; no Claude implementation).
- Respect org CI conventions ("Pipeline Complete" aggregator, squash-only).
- No AI/Claude attribution anywhere.
