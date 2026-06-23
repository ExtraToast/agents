# Tasks: continue a workspace onto an updated agent-runner image

Backend (agents-api) before UI (agents-ui). Each layer independently testable.

## Phase A — agents-api: runner-image identity (FR-001)

- [x] T001 Add `runnerImageDigest` to `RunnerState` (parsed from `pod.status.containerStatuses[0].imageID`, digest portion).
- [x] T002 `Fabric8AgentRunnerOrchestrator`: stamp `agent-runner/runner-image-digest` at provision (best-effort) and populate `runnerImageDigest` in `runnerState(pod)`.
- [x] T003 Orchestrator + `AgentRunnerOrchestrator` port: `freshestRunnerImageDigest()` (newest running runner Pod digest) and `runnerImageDigest(workspace)`.
- [x] T004 Tests: digest parsing, freshest-observed selection, null-safety (no runners / not-yet-ready).

## Phase B — agents-api: upgrade action (FR-002, FR-004..FR-010)

Implemented by **reusing the existing session restart path** rather than a new endpoint — `restart()` → `forceProvisionAndWait()` already unconditionally scales down + reprovisions (Always-pull → latest image) and resumes the conversation (`resumeCliSessionId`, epoch++), preserving the PVC. The operator action is the UI "Update runner" button (Phase E) which drives `restartSession`.

- [~] T005 SUPERSEDED — no `provision(force=true)` needed; `forceProvisionAndWait` already force-recreates.
- [~] T006 SUPERSEDED — no dedicated `upgradeRunner` lifecycle method; the UI action calls the existing `restartSession`. (`runnerImageStatus` was added for the indicator instead.)
- [x] T007 Continuation is covered by the existing `RunnerSessionBindingServiceTest` (restart/forceProvisionAndWait/resume).

## Phase C — agents-api: DTO (FR-003) — endpoint superseded by reuse

- [~] T008 SUPERSEDED — no `POST /runner/upgrade`; reuses the existing session-restart endpoint.
- [x] T009 `WorkspaceDtos`: `runnerImage { digest, upgradeAvailable }` on the workspace detail response (`WorkspaceRunnerLifecycleService.runnerImageStatus` computes it; controller maps it).
- [x] T010 Regenerated `openapi.json` + agents-ui `generated.ts`.
- [x] T011 `WorkspaceControllerTest`: `GET` returns `runnerImage` with short digest + `upgradeAvailable`.

## Phase D — agents-api: idle auto-upgrade (FR-012, SC-007)

- [x] T012 No scheduler code change needed: `isRunnerImageStale` is now runner-image-aware (digest behind freshest), so the existing `IdleScaleDownScheduler` sweep — which already calls `isRunnerImageStale` behind its connected-client + agent-idle `staleRunnerSafeToRecycle` guard — auto-recycles idle behind-image runners.
- [x] T013 The sweep's recycle-on-stale + safe-to-recycle guards are covered by `IdleScaleDownSchedulerTest` (it stubs `isRunnerImageStale`); the new digest-comparison logic that drives it is covered by `RunnerImageDigestsTest`.

## Phase E — agents-ui (FR-002, FR-003, FR-011)

- [x] T014 `runnerImage { digest, upgradeAvailable }` added to the workspace type; flows through the existing `getWorkspace` mapping. (No `workspaceService.upgradeRunner` — reuses the restart path.)
- [~] T015 SUPERSEDED — no new store action; `WorkspaceView.onUpdateRunner` calls the existing `store.restartSession`, driving the existing reattach/replay states.
- [x] T016 `SessionStatusRail.vue`: primary "Runner" tile = "<digest> · up to date / update available" + "Update runner" button gated on `upgradeAvailable` (emits `updateRunner`); setup/generation demoted to a secondary "Runner setup" tile.
- [x] T017 `SessionStatusRail.test.ts`: up-to-date, update-available + button emit, no-runner.

## Phase F — ship & verify

- [ ] T018 Run agents-api tests + ktlint; agents-ui typecheck + lint + tests.
- [ ] T019 PR(s), merge, release, deploy.
- [ ] T020 Live verification per quickstart (recreate onto newer digest, conversation resumes, idle auto-recycle, indicator accuracy).
