# Tasks: continue a workspace onto an updated agent-runner image

Backend (agents-api) before UI (agents-ui). Each layer independently testable.

## Phase A — agents-api: runner-image identity (FR-001)

- [x] T001 Add `runnerImageDigest` to `RunnerState` (parsed from `pod.status.containerStatuses[0].imageID`, digest portion).
- [x] T002 `Fabric8AgentRunnerOrchestrator`: stamp `agent-runner/runner-image-digest` at provision (best-effort) and populate `runnerImageDigest` in `runnerState(pod)`.
- [x] T003 Orchestrator + `AgentRunnerOrchestrator` port: `freshestRunnerImageDigest()` (newest running runner Pod digest) and `runnerImageDigest(workspace)`.
- [x] T004 Tests: digest parsing, freshest-observed selection, null-safety (no runners / not-yet-ready).

## Phase B — agents-api: upgrade action (FR-002, FR-004..FR-010)

- [x] T005 `Fabric8AgentRunnerOrchestrator`: a force-recreate (scaleDown + provision regardless of readiness) or `provision(force=true)`.
- [x] T006 `WorkspaceRunnerLifecycleService.upgradeRunner(workspaceId)`: serialize via boot lease; no-op + `already-current` when `runnerDigest == freshest`; else force-recreate and continue every bound session via the existing `RunnerSessionBinder` restart-and-continue (epoch++, resume, reason="runner-image-upgrade"); preserve PVC; recoverable on failure.
- [x] T007 Tests: recreate path, no-op when current, lease serialization, multi-session continuation, failure recoverable.

## Phase C — agents-api: endpoint + DTO (FR-002, FR-003)

- [x] T008 `WorkspaceController`: `POST /api/v1/workspaces/{id}/runner/upgrade` → states upgrading/already-current/unavailable; 404/409/503 mapping.
- [x] T009 `WorkspaceDtos`: add `runnerImage { digest, upgradeAvailable }` to the workspace/connect response.
- [x] T010 Regenerate `openapi.json` (+ agents-ui `generated.ts`) iff the response is a typed DTO.
- [x] T011 Controller tests: endpoint states; `runnerImage` present + `upgradeAvailable` correct.

## Phase D — agents-api: idle auto-upgrade (FR-012, SC-007)

- [x] T012 `IdleScaleDownScheduler`: also recycle idle runners whose digest != freshest observed, with the existing connected-client + idle-grace guards.
- [x] T013 Tests: recycles idle behind-image runner; never with clients / non-idle agents.

## Phase E — agents-ui (FR-002, FR-003, FR-011)

- [x] T014 `workspaceService.upgradeRunner(workspaceId)` + `runnerImage` on the workspace type.
- [x] T015 `stores/workspaces.ts`: `upgradeRunner()` action posting the endpoint and driving the reattach/replay states.
- [x] T016 `SessionStatusRail.vue`: primary runner status = "Runner image: <short> — up to date / Upgrade available" + "Update runner" button gated on `upgradeAvailable`; demote the setup/generation detail to secondary.
- [x] T017 Store + component tests.

## Phase F — ship & verify

- [ ] T018 Run agents-api tests + ktlint; agents-ui typecheck + lint + tests.
- [ ] T019 PR(s), merge, release, deploy.
- [ ] T020 Live verification per quickstart (recreate onto newer digest, conversation resumes, idle auto-recycle, indicator accuracy).
