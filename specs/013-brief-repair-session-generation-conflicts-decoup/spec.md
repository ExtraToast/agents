# Feature Spec: Repair Session Runner Boot Conflicts

## Outcomes

- Opening or connecting to a workspace idempotently boots or observes the runner without creating an agent session.
- Session creation is bind-only against an already-provisioned runner.
- Ordinary runner cold-start/setup-in-flight states return readiness snapshots or retryable 503s, not 409 session generation conflicts.
- Concurrent create/connect/open calls cannot stale-apply an old Kubernetes runner spec over a newer setup restart.
- Existing session SSE survives initial page load better, and the UI treats transient EventSource errors as reconnecting.

## Non-Goals

- Do not auto-spawn an agent session on workspace open.
- Do not reuse `RunnerSetupOperation` for boot-only progress.
- Do not add runner readiness data to the existing global session-status broadcaster without server-side workspace scoping.
- Do not introduce client setup selection for new session HTTP requests unless the DTO is deliberately expanded in a separate change.

## State And Reason Contracts

Workspace runner snapshot states should cover at least: `ABSENT`, `TERMINAL`, `IDENTITY_MISMATCH`, `SETUP_MISMATCH`, `STALE_IMAGE`, `PENDING`, `RUNNING_NOT_READY_GRACE`, `RUNNING_NOT_READY_STALE`, `GATEWAY_NOT_READY`, `BOOTING`, `READY`, `FAILED`, and `SETUP_OPERATION_IN_PROGRESS`.

HTTP 503 ProblemDetail `runnerStatus` must use stable enum strings. Pre-bind retryable reasons include `NoRunnerMetadata`, `RunnerPodMissing`, `RunnerPending`, `RunnerContainerNotReady`, `GatewayCold`, `RunnerBootInProgress`, `SetupOperationInProgress`, `RunnerIdentityMismatch`, `RunnerSetupMismatch`, `RunnerImageStaleDeferred`, and `RunnerBootFailedRetryable`. Non-retry post-save reasons include `GatewayConnectionRefused` and `AgentSpawnFailed`.

## Boot Lease Contract

Add separate boot fields such as `runner_boot_status`, `runner_boot_attempt_id`, `runner_boot_started_at`, `runner_boot_updated_at`, and `runner_boot_error`. Boot methods use attempt/status/timestamp guards and never mutate pending setup fields or `runner_setup_generation`.

A fresh active boot lease returns a `BOOTING` snapshot and never provisions a second pod. A stale boot lease can be released or stolen only after a configured threshold. Explicit setup-changing restart wins by acquiring setup CAS; boot code must check setup generation/identity immediately before Kubernetes apply and must not apply stale specs.

## Connect Contract

`POST /api/v1/workspaces/{id}/connect` returns a snapshot with workspace id, workspace status, setup reference, runner setup generation/operation, boot metadata safe for UI, `runnerReady`, runner state/status, `retryAfterSeconds` or `pollAfterSeconds`, and timestamps. It returns 200 for observe/ready, 202 for initiated/in-progress boot, 404 for missing workspace, and 503 for lifecycle infrastructure failures.

## Frontend Contract

Route/user navigation calls `open(id, { connectRunner: true })`. Internal refreshes call `open(id, { connectRunner: false })`. Session start retries only allowlisted pre-bind 503 reasons. No session POST occurs on mount/open before explicit user action.
