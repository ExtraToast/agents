# Feature Spec: Repair Session Runner Boot

## Outcomes

- Opening or connecting to a workspace idempotently boots or observes the runner without creating an agent session.
- Session creation is bind-only against an already-provisioned, ready runner.
- Ordinary runner cold-start and setup-in-flight states return readiness snapshots or retryable 503s, not 409 session-generation conflicts.
- Concurrent create/connect/open calls cannot stale-apply an old Kubernetes runner spec over a newer setup restart.
- Existing session SSE survives initial page load better, and the UI treats transient EventSource errors as reconnecting rather than fatal.

## Non-Goals

- Do not auto-spawn an agent session on workspace open or mount.
- Do not reuse `RunnerSetupOperation` for boot-only progress reporting.
- Do not add runner readiness data to the existing global session-status broadcaster without server-side workspace scoping.
- Do not introduce client setup selection for new session HTTP requests unless the DTO is deliberately expanded in a separate change.

## Separate Boot Lease

Add dedicated boot fields alongside setup fields: `runner_boot_status`, `runner_boot_attempt_id`, `runner_boot_started_at`, `runner_boot_updated_at`, and `runner_boot_error`.

Boot methods use attempt/status/timestamp guards and never mutate pending setup fields or `runner_setup_generation`. A fresh active boot lease returns a `BOOTING` snapshot and never provisions a second pod. A stale boot lease may be released or stolen only after a configured threshold.

Explicit setup-changing restarts win by acquiring the setup CAS. Boot code must read setup generation and identity immediately before any Kubernetes apply and must not apply stale specs.

## Transaction Boundaries

Boot lease acquisition and release are each a single conditional database update (CAS on `runner_boot_attempt_id` and `runner_boot_status`). No boot state mutates setup/generation columns. Session bind reads runner state and writes the new session row in one transaction; it must not trigger a Kubernetes apply. The connect endpoint reads the workspace snapshot in a single read-only transaction and returns it without side effects unless it initiates a boot.

## Connect Response Semantics

`POST /api/v1/workspaces/{id}/connect` returns a JSON snapshot containing:
- `workspaceId`, `workspaceStatus`, `setupRef`
- `runnerSetupGeneration`, `runnerSetupOperation`
- boot metadata safe for UI: `bootStatus`, `bootAttemptId`, `bootStartedAt`, `bootUpdatedAt`, `bootError`
- `runnerReady` boolean, `runnerState`, `runnerStatus`
- `retryAfterSeconds` (when booting/setup-in-progress) or `pollAfterSeconds` (when ready but session not bound)
- `timestamps`

HTTP status codes:
- **200** — runner already ready (observe/ready path)
- **202** — boot initiated or in progress
- **404** — workspace not found
- **503** — retryable lifecycle infrastructure failure (with `runnerStatus` reason in ProblemDetail)

## Bind-Only Session Semantics

`POST /api/v1/workspaces/{id}/sessions` (or equivalent session-create endpoint) must only bind against an already-running, ready runner. It must not trigger a Kubernetes apply, must not start a boot, and must not succeed if the runner snapshot is not in `READY` state. Callers that receive a pre-bind 503 must retry `connect` first, then re-attempt session bind.

## Stable Runner Reason Values

HTTP 503 `ProblemDetail.runnerStatus` must use stable enum strings matched one-to-one to runner snapshot states.

**Pre-bind retryable reasons** (connect returns 503, client should retry connect):

| Reason | Meaning |
|---|---|
| `NoRunnerMetadata` | Runner record has no pod identity yet |
| `RunnerPodMissing` | Pod not found in Kubernetes |
| `RunnerPending` | Pod scheduled but container not started |
| `RunnerContainerNotReady` | Container running but readiness probe failing |
| `GatewayCold` | Gateway process alive but not yet accepting connections |
| `RunnerBootInProgress` | Active boot lease in progress |
| `SetupOperationInProgress` | Setup operation occupying the runner |
| `RunnerIdentityMismatch` | Pod identity does not match expected runner identity |
| `RunnerSetupMismatch` | Runner setup generation does not match workspace setup |
| `RunnerImageStaleDeferred` | Image update deferred; runner running stale image |
| `RunnerBootFailedRetryable` | Previous boot failed but is safe to retry |

**Post-bind non-retryable reasons** (session bind or spawn failed):

| Reason | Meaning |
|---|---|
| `GatewayConnectionRefused` | Runner ready but gateway refused connection at bind time |
| `AgentSpawnFailed` | Gateway accepted bind but agent process did not start |

## SSE Scoping

Runner readiness SSE events (boot progress, runner state changes) must be scoped to a workspace identifier server-side. A client subscribing to workspace `W` must not receive events from workspace `W2`. The broadcaster must not fan out a boot-progress event to global session-status subscribers.

If the workspace-scoped SSE channel is unavailable at page load, the client falls back to polling `connect` at `pollAfterSeconds` intervals. Transient EventSource network errors trigger reconnect with exponential backoff rather than resetting the session or surfacing a fatal error to the user.

## No-Auto-Spawn Regression

Route and user-navigation calls to `open(id, { connectRunner: true })` invoke connect but do not POST a new session. Internal refresh calls use `open(id, { connectRunner: false })` and do not invoke connect at all. No session POST occurs on mount or open before an explicit user action (e.g. a "Start session" button press). This must be covered by a regression test that mounts the workspace page and asserts zero session-creation requests.

## Validation Cases

The following cases must be covered by integration or unit tests:

1. **Concurrent boot requests** — two simultaneous connect calls for the same workspace; exactly one succeeds in acquiring the boot lease, the other receives a `RunnerBootInProgress` 503.
2. **Stale boot stolen** — a boot attempt started beyond the stale threshold; a new connect call steals the lease and the old attempt's apply is rejected due to generation/identity check.
3. **Setup CAS wins over boot** — a setup-changing restart races with an in-flight boot; setup CAS acquisition cancels the boot and proceeds with setup.
4. **Bind against non-ready runner** — a session POST while runner state is `BOOTING`; response is 503 with a pre-bind reason, no Kubernetes apply occurs.
5. **Connect returns 200 for ready runner** — runner already in `READY` state; connect returns 200 with `runnerReady: true` and no boot is initiated.
6. **Connect returns 202 on fresh boot** — runner in `ABSENT` state; connect initiates boot and returns 202 with `bootAttemptId` and `retryAfterSeconds`.
7. **SSE scoping isolation** — workspace A's boot-progress event is not delivered to workspace B's SSE subscriber.
8. **No session POST on page load** — mounting the workspace view with `connectRunner: true` produces no session-creation HTTP request.
9. **Stale image deferred** — runner running an old image but not yet scheduled for update; connect returns 503 with `RunnerImageStaleDeferred`, client retries without triggering a pod replacement.
10. **Missing workspace** — connect for a non-existent workspace id returns 404.
