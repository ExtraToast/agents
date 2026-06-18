# Brief: Native cross-platform Vue app for Accounts + Auth + full Agents system

## Goal

Design (plan only — no code yet) a **native, cross-platform Vue application**
that runs on **Android and iOS** (and as a web app) and provides:

1. **Account administration** — the admin surface over users (list, view,
   change role, set entitled services, delete). Maps to auth-api
   `/api/v1/admin/users` (`GET`, `GET /{id}`, `DELETE /{id}`,
   `PATCH /{id}/role`, `PUT /{id}/services`).
2. **Auth** — login, logout, token refresh, session-login, forward-auth verify,
   TOTP/2FA challenge. Maps to auth-api `/api/v1/auth/*` and `/api/v1/totp/*`.
3. **Signups for new users** — registration, email confirmation, resend
   confirmation, forgot/reset password. Maps to auth-api
   `/api/v1/users/{register,confirm-email,resend-confirmation,forgot-password,
   reset-password}`.
4. **Account modifications** — self-service profile + password + TOTP enrollment.
   Maps to auth-api `/api/v1/users/me`, `/users/me/change-password`,
   `/totp/{enroll,verify}`.
5. **Full access to ALL features of the agents system** — everything the
   existing `agents-ui` exposes, at parity: workspaces, sessions incl. the
   **terminal** (xterm) and live **SSE status**, **streaming chat**
   (conversations/messages), chat-sessions, projects, repositories,
   agent-setups, git open-PR. Maps to agents-api `/api/v1/*`.

## Hard requirements

- **Platforms:** Android + iOS native apps, plus a web build. One Vue codebase.
- **Vue version:** Use the most recent Vue available. NOTE for planners: as of
  2026-06, **Vue 4 has not shipped** — current is Vue 3.5.x. Target latest
  Vue 3.x and keep the codebase forward-compatible with Vue 4 when it lands.
  Do not block on a non-existent version.
- **Backwards support — maximize it:**
  - Mobile OS: support as far back as is reasonably feasible (state the floor,
    e.g. Android API / iOS major, and the tradeoffs).
  - Web: broad browser support / graceful degradation where practical.
  - API/contract: tolerate older auth-api / agents-api contract versions where
    feasible; plan a contract-version strategy.
- **Backend is fixed:** auth-api lives in `personal-stack/services/auth-api`
  (Spring, session-cookie + JWT/refresh); agents-api lives in
  `agents/services/agents-api`. The app is a CLIENT — do not redesign the
  backends, but DO call out any backend gaps that block native clients
  (the big one: **session cookies vs. a native token flow** — `/auth/refresh`
  and JWT exist; design the native auth around tokens, and specify exactly what
  auth-api must expose if anything is missing).

## Required architecture decision (planners MUST debate + recommend)

The phrase "native script vue" is ambiguous. Evaluate as a first-class,
cross-critiqued decision and give a clear recommendation with rationale:

- **NativeScript-Vue** — truly native UI; but cannot reuse PrimeVue/DOM
  components, xterm terminal, or the existing `agents-ui`; near-total UI rewrite.
- **Capacitor** (wrap the existing Vue 3 + PrimeVue web app in native shells) —
  maximum reuse of the agents-ui reference stack and best backwards support;
  WebView-based.
- **Ionic Vue** (+ Capacitor) — native-feeling components, Capacitor underneath.
- **Tauri 2 Mobile** — Rust shell, web UI; lighter, newer/less mature on mobile.

Weigh against: feature parity with agents-ui (terminal, SSE, streaming chat),
backwards support, code reuse, maintenance cost, team's existing Vue/PrimeVue/
Tailwind/Pinia/Zod/OpenAPI-codegen expertise, and the offline/secure-token
needs of a mobile auth client.

## Reference implementation (study and reuse where possible)

- `agents/services/agents-ui` — the canonical agents web app to reach parity
  with. Stack: Vue 3.5, PrimeVue 4, Pinia 3, vue-router 5, Vite 8, Tailwind 4,
  Zod 4, `@extratoast/vue-web-commons`, OpenAPI→TS client
  (`openapi-typescript` from `agents-api/openapi.json`), `@xterm/*`(+webgl),
  SSE, MSW (tests), Playwright (e2e), Stryker (mutation), dependency-cruiser,
  Faro telemetry.
- `personal-stack/services/auth-ui` — existing auth/login/profile web UI
  (same stack, `@extratoast/vue-web-commons`). Mine it for the auth/account/
  signup flows the new app must reproduce on mobile.
- `vue-web-commons` (`@extratoast/vue-web-commons`) — shared component/util lib;
  decide what is reusable on the chosen mobile target and what needs a variant.

## What the plan must deliver (be EXTENSIVE — the user explicitly wants many specs)

Produce a large, spec-driven plan, structured as a numbered spec set compatible
with the repo's Spec Kit convention (`specs/NNN-slug/spec.md`, plan.md,
tasks.md). At minimum, separate specs for:

1. Architecture-decision record for the native target (the decision above).
2. Project scaffold + monorepo placement (new repo vs new service in `agents`)
   + shared-code strategy with vue-web-commons + CI baseline ("Pipeline
   Complete" aggregator, squash-only) per the org convention.
3. Cross-platform build & release: Android (Play) + iOS (App Store/TestFlight)
   pipelines, signing, versioning, OTA/web deploy, store metadata.
4. Native auth: token storage (secure keychain/keystore), refresh, biometric
   unlock, deep links for email-confirmation/reset, forward-auth interplay.
5. Auth flows: login, logout, TOTP enroll + challenge, session handling.
6. Signup flows: register, email confirmation, resend, forgot/reset password.
7. Account self-service: profile (`/users/me`), change password, TOTP mgmt.
8. Admin: user list/detail, role change, services entitlement, delete; RBAC
   gating in the UI.
9. Agents — workspaces.
10. Agents — sessions + terminal (xterm equivalent on the chosen target) + live
    SSE status (this is the hardest parity item on mobile WebView/native).
11. Agents — streaming chat (conversations/messages) + chat-sessions.
12. Agents — projects + repositories + repo verify/keys.
13. Agents — agent-setups + setup wizard/transitions/preview.
14. Agents — git open-PR.
15. API client + contract: OpenAPI codegen for BOTH apis, contract checks,
    contract-version/backwards-compat strategy, error model, retry/backoff.
16. State, routing, navigation, offline behavior, background/foreground.
17. Design system / theming: PrimeVue+Tailwind reuse vs native, dark mode,
    accessibility, responsive + mobile gestures.
18. Telemetry/observability (Faro or native equivalent), crash reporting.
19. Testing strategy: unit (vitest), component, contract (MSW), e2e
    (Playwright web + native e2e on device/emulator), mutation (Stryker).
20. Security: secret storage, cert pinning, OWASP MASVS-style checklist,
    XSRF/cookie handling, jailbreak/root considerations.
21. Backwards-support matrix: min OS versions, browser support, polyfills,
    contract-version tolerance — explicit and justified.
22. Rollout/migration: relationship to existing web UIs, feature flags, phased
    delivery, dogfooding.

Each spec needs: scope, the exact API endpoints it consumes, data/types,
acceptance criteria, test plan, and dependencies on other specs. Include a
task DAG suitable for parallel fan-out.

## Definition of done for the PLAN

- A consolidated, cross-critiqued plan + a numbered spec set + a `tasks.json`
  DAG with dependencies, ready for fan-out.
- The native-target decision is made and justified.
- Backwards-support floors are explicit.
- Every backend gap that blocks a native client is named with the precise
  auth-api/agents-api change required.

## Constraints / conventions (from repo + operator)

- Org CI convention: single workflow → "Pipeline Complete" aggregator as the
  only required check; squash-only; pull repo-template CI baseline in the first
  PR before features.
- No Claude/AI co-author trailers or "Generated with Claude Code" in commits/PRs.
- Cross-repo: auth-api changes (if any) land in `personal-stack`; app + agents
  changes land in `agents` (or a new ExtraToast repo — that placement is a
  decision for the plan).
