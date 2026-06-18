# Brief: Repair session-generation conflicts + decouple runner boot from session creation

## Goal
Repair the continuous "session generation conflict" (409) errors and SSE
connection drops in `ExtraToast/agents`, and make the agent **runner boot the
moment a workspace is created OR connected to** — not lazily when a Claude Code /
other agent session is first created. Session creation must become a *bind-only*
operation against an already-provisioned runner.

## Symptoms (observed in prod, agents.jorisjonkers.dev)
1. `POST /api/v1/workspaces/{id}/sessions` → **409** `ApiError: session
   generation conflict: <uuid>`, repeatedly, on opening a workspace.
2. SSE `GET /api/v1/sessions/events` → "connection interrupted while page was
   loading" during initial load.

## Root causes (from code exploration of /workspace/agents)
- Two competing runner-provisioning paths:
  - **Workspace create**: `CreateWorkspaceCommandHandler.kt` L88-92
    `provisionAndUpdate(...)` already provisions a runner pod (async pod startup).
  - **Session create**: `AgentSessionController.start` →
    `StartAgentSessionCommandHandler` → `RunnerSessionBinder.startInternal` →
    `prepareRunner()` (`RunnerSessionBinder.kt` ~L332-372). If the runner is not
    *already ready*, it **leases the workspace** via `beginRunnerSetupRestart` +
    CAS `tx.beginWorkspaceSetupOperation` on `Workspace.runnerSetupGeneration`.
    If `runnerSetupOperation != IDLE` or `pendingRunnerSetupId/Version` is set
    (i.e. the create-time provisioning is still in flight), it throws
    `RunnerSetupOperationConflict` → handler maps to
    `error("session generation conflict: ...")` → **409**.
  - => Session-start races the still-in-flight workspace-create provisioning.
- Frontend: `WorkspaceView` creates a session on mount/open;
  `workspaceService.startSession` retries **only on 503** (180s budget), not on
  409, so the conflict surfaces immediately. No de-dup guard against concurrent /
  duplicate `POST /sessions`; `startingSession` flag does not gate the spawn path.
- SSE: `SessionStatusController` GET `/sessions/events` → `SseEmitter` via
  in-memory per-user `SessionStatusBroadcaster`; frontend `EventSource` in
  `sessionStatusStream.ts`, `onerror` → "Session status stream disconnected". No
  robust reconnect/backoff during page load.

## Decisions (confirmed with user)
- **Connect behavior**: opening/connecting to a workspace whose runner pod is
  gone must **auto-reboot the runner idempotently** on open, with a clear
  readiness signal. ("boot the moment workspace is connected to".)
- **No auto-spawn**: opening a workspace boots the **runner only**; agent
  sessions are created explicitly by the user. Remove the create-session-on-mount
  race.
- **Intensity**: standard council run.

## Desired design direction
1. **Runner lifecycle owned by the workspace**, not the session:
   - Provision on workspace create (keep) AND on workspace connect/open
     (new, idempotent — re-provision only if pod missing/unhealthy).
   - Single source of truth for "is the runner ready" with a readiness signal
     (status + SSE/event) the frontend can await.
2. **Session-start becomes bind-only**:
   - `RunnerSessionBinder` must NOT lease/restart the runner setup operation on
     the normal session-start path. If the runner is not yet ready, return
     **503 + Retry-After** (client already handles 503 with backoff), never 409.
   - Remove the competing provisioning path from session start.
3. **Conflict semantics tightened**:
   - Reserve `runnerSetupGeneration` CAS conflicts for *genuine concurrent setup
     CHANGES* (e.g. user changing the runner setup), not for ordinary
     session-start. When a real CAS conflict happens, surface a retryable signal
     the client refetches + retries gracefully instead of a hard error.
4. **A "connect to workspace" trigger/endpoint** that idempotently (re)boots the
   runner if the pod is gone, returning current readiness.
5. **SSE stability**: reconnect with backoff on the client; ensure the stream
   survives initial page load (keepalive/heartbeat, correct buffering headers,
   reconnect on `onerror`). Verify server emitter lifecycle.
6. **Frontend**: bind-only `startSession` (treat transient non-ready as 503-style
   wait), de-dup guard so concurrent/duplicate `POST /sessions` cannot fire,
   disable spawn affordance while a start is in flight, and remove
   auto-spawn-on-open.

## Constraints / repo conventions
- Backend: Kotlin + Spring Boot + jOOQ (`services/agents-api`), CQRS command bus,
  optimistic-locking via generation/CAS. Flyway-style migrations (use `sort -V`
  for latest). jOOQ DDL parser rejects `ON CONFLICT`.
- Frontend: Vue 3 + Pinia + TS (`services/agents-ui`); reusable bits belong in
  `vue-web-commons` where appropriate.
- CI: single workflow aggregating to **"Pipeline Complete"** (only required
  check); **squash-only** merges. detekt / compileTestKotlin / openapi-contract /
  banner / local-UI-verify are recurring gates.
- No Claude/AI co-author trailers. Codex workers run in full bypass; gradle-gated
  verification must happen in CI (sandbox blocks gradle sockets / GH Packages).

## Deliverable
A concrete design + a **parallelizable task DAG** covering: backend
workspace-runner-lifecycle (boot on create+connect, idempotent reprovision,
readiness signal), session-start bind-only path (503 not 409), tightened
CAS-conflict semantics, connect endpoint, SSE reconnect/backoff (client+server),
frontend bind-only startSession + de-dup + remove auto-spawn, and tests for each.
Tasks should be independently executable in isolated worktrees where possible.
