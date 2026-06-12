# Tasks: 002-session-persistence-restart

**Input**: Design documents from `/specs/002-session-persistence-restart/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), websocket attach contract from `/workspace/personal-stack/specs/002-assistant-responsiveness-streaming-chat-terminal/contracts/ws-attach-resume.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks because it touches different files
- **[Story]**: User story label, for example US1, US2, US3
- Include exact file paths in descriptions
- Backend Gradle validation may be CI-only in worker environments; record when `./gradlew` was not run locally

## Phase 1: Setup

- [ ] T001 [P] Confirm the implementation branch still has the gateway, API, and UI paths listed in [plan.md](./plan.md), especially `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt`, `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/model/WorkspaceAgentSession.kt`, and `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [ ] T002 Identify the smallest validation commands before edits: `./gradlew :services:agent-gateway:test`, `./gradlew :services:agents-api:test`, and `cd services/agents-ui && pnpm run typecheck && pnpm run lint && pnpm run test`

## Phase 2: Foundational (FR-001, FR-002, FR-005, FR-008, FR-009)

- [ ] T003 [FR-001] Add stable-session spawn fields to gateway request/response handling in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/web/AgentController.kt` and `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt`
- [ ] T004 [FR-001] Add `epoch: Long` and stable session id fields to the gateway `AgentSession` model in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/`
- [ ] T005 [FR-002] Add gateway transcript configuration for the PVC-backed session directory and per-session cap in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/config/GatewayProperties.kt` and `services/agent-gateway/src/main/resources/application.yml`
- [ ] T006 [FR-002] Create a gateway transcript store under `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/` that maps stable session id to transcript path, `logStart`, and `logLen`
- [ ] T007 [FR-008] Add a per-session single-writer guard in the gateway transcript store under `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/`, including stale-owner recovery for pod death
- [ ] T008 [FR-002] Replace truncate-to-zero log trimming with front trimming in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt` so retained byte offsets remain valid
- [ ] T009 [FR-005] Add `epoch` and generation metadata to `WorkspaceAgentSession` in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/model/WorkspaceAgentSession.kt`
- [ ] T010 [FR-005] Add a Flyway migration for session epoch/generation fields in `services/agents-api/src/main/resources/db/migration/`
- [ ] T011 [FR-005] Persist and hydrate the new session fields in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/persistence/JooqWorkspaceAgentSessionRepository.kt`
- [ ] T012 [FR-009] Add or update base websocket frame tests for additive `off`, `epoch`, and `snapshot` fields in `services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandlerTest.kt` and `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts`

## Phase 3: User Story 1 (Priority: P1) - Continue After Restart With Updated Setup

**Goal**: Restart an existing logical session onto a fresh runner generation, keep full prior transcript visible, and continue under the updated setup.

**Independent Test**: Produce scrollback, invoke restart/continue for the same session id, reopen the terminal, verify prior transcript plus a restart delimiter, then send input to the fresh process.

### Gateway

- [ ] T013 [US1] Update `AgentSessionManager.spawn()` in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt` to create or reopen the PVC transcript for the provided stable session id instead of deleting the log on every spawn
- [ ] T014 [US1] Write the visible restart delimiter to the durable transcript during restarted generation spawn in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt`
- [ ] T015 [US1] Add `startOffset` support to `LogTailer.start()` in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/LogTailer.kt`
- [ ] T016 [US1] Change `LogTailer` callbacks in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/LogTailer.kt` to include the post-chunk byte offset used as `off`
- [ ] T017 [US1] Implement `epoch`/`offset` parsing and RESUME-vs-SNAPSHOT branching in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandler.kt`
- [ ] T018 [US1] Emit one control frame before output and include optional `off` on output frames in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandler.kt`

### API

- [ ] T019 [US1] Extend `AgentGatewayClient.spawnAgent()` and `HttpAgentGatewayClient` in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/port/AgentGatewayClient.kt` and `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/integration/HttpAgentGatewayClient.kt` to pass stable session id and epoch to the gateway
- [ ] T020 [US1] Add a restart/continue command and handler under `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/` that preserves the existing session id, bumps epoch, re-provisions the runner if needed, spawns a fresh gateway agent, and saves the new binding
- [ ] T021 [US1] Add an API route for restart/continue in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/AgentSessionController.kt`
- [ ] T022 [US1] Update API response DTOs and OpenAPI artifacts if the restart/continue route is public in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/dto/` and `services/agents-api/openapi.json`
- [ ] T023 [US1] Pass browser `epoch` and `offset` query parameters through upstream attach URIs in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/SessionAttachHandler.kt`

### UI

- [ ] T024 [US1] Track `lastOff` and `lastEpoch` from inbound frames in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [ ] T025 [US1] Append `?epoch={lastEpoch}&offset={lastOff}` lazily on reconnect only after both values are known in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [ ] T026 [US1] Add `onControl(epoch, snapshot)` support in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [ ] T027 [US1] Remove unconditional reconnect `term.reset()` from `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` and clear only on `snapshot === true` via `term.clear()`

### Tests

- [ ] T028 [US1] Add gateway tailer tests for `startOffset`, post-chunk `off`, and UTF-8 carry behavior in `services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/LogTailerTest.kt`
- [ ] T029 [US1] Add gateway attach tests for matching epoch resume, stale epoch snapshot, out-of-range offset snapshot, and backward-compatible output frames in `services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandlerTest.kt`
- [ ] T030 [US1] Add API tests for restart/continue epoch bump and same-session rebinding in `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/command/`
- [ ] T031 [US1] Add API websocket tests proving attach query passthrough and verbatim frame relay in `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/SessionAttachHandlerTest.kt`
- [ ] T032 [US1] Add UI socket tests for first-connect snapshot, reconnect query, control callback, and `off` tracking in `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts`
- [ ] T033 [US1] Add terminal component tests proving reconnect no longer resets and snapshot control clears in `services/agents-ui/src/features/workspaces/__tests__/SessionTerminal.test.ts`

## Phase 4: User Story 2 (Priority: P2) - History Survives Unplanned Restart

**Goal**: Preserve transcript bytes through pod death/reschedule and make the same logical session attachable again.

**Independent Test**: Kill the runner pod mid-session, wait for re-provisioning, reattach to the same session id, and verify prior transcript plus live input.

### Gateway

- [ ] T034 [US2] Ensure gateway startup and spawn tolerate existing session transcript directories without deleting retained bytes in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt`
- [ ] T035 [US2] Ensure stale single-writer guards can be reclaimed safely after pod death in the gateway transcript guard implementation under `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/`

### API

- [ ] T036 [US2] Teach attach or restart/continue orchestration to re-provision a missing runner and spawn a new generation for an existing session in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/` and `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/SessionAttachHandler.kt`
- [ ] T037 [US2] Preserve resumable session rows during idle scale-down and runner maintenance in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/idle/IdleScaleDownScheduler.kt` and `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/maintenance/RunnerMaintenanceService.kt`
- [ ] T038 [US2] Ensure workspace PVC preservation remains explicit during re-provisioning in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/k8s/Fabric8AgentRunnerOrchestrator.kt`

### UI

- [ ] T039 [US2] Keep existing heartbeat, reconnect backoff, queueing, and inactive-tab reconnect gating unchanged while adding resume cursor behavior in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`

### Tests

- [ ] T040 [US2] Add gateway guard recovery tests under `services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/`
- [ ] T041 [US2] Add API tests for re-provisioning an existing session after runner unavailability in `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/command/`
- [ ] T042 [US2] Add idle/maintenance tests proving resumable session metadata and PVCs are not reclaimed in `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/idle/IdleScaleDownSchedulerTest.kt` and `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/maintenance/RunnerMaintenanceServiceTest.kt`

## Phase 5: User Story 3 (Priority: P3) - Bounded Multi-Session Durable Storage

**Goal**: Multiple sessions persist independently without unbounded PVC growth.

**Independent Test**: Run multiple sessions past the cap, verify independent transcript paths, bounded retained bytes, snapshot fallback for evicted offsets, and cleanup for stopped or expired sessions.

### Gateway

- [ ] T043 [US3] Enforce per-session transcript cap and independent session directories in the gateway transcript store under `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/`
- [ ] T044 [US3] Add cleanup of stopped-session transcript directories through the gateway/session lifecycle in `services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt`

### API

- [ ] T045 [US3] Add retention configuration for stopped or expired durable sessions in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/AgentRuntimeProperties.kt` and `services/agents-api/src/main/resources/application.yml`
- [ ] T046 [US3] Add a cleanup command or scheduled service for reclaimable durable sessions under `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/`
- [ ] T047 [US3] Ensure stop/delete session flows mark sessions reclaimable without deleting active transcript bytes prematurely in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/StopAgentSessionCommandHandler.kt`

### UI

- [ ] T048 [US3] Handle snapshot fallback after offset eviction without duplicate visible output in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` and `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue`

### Tests

- [ ] T049 [US3] Add gateway tests for independent session caps, front trimming, and offset-eviction snapshot fallback under `services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/`
- [ ] T050 [US3] Add API retention tests for stopped/expired session cleanup under `services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/`
- [ ] T051 [US3] Add UI tests for snapshot fallback after a previously valid offset is evicted in `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts` and `services/agents-ui/src/features/workspaces/__tests__/SessionTerminal.test.ts`

## Phase 6: Polish and Validation

- [ ] T052 Run or record CI-only status for `./gradlew :services:agent-gateway:test`
- [ ] T053 Run or record CI-only status for `./gradlew :services:agents-api:test`
- [ ] T054 Run `cd services/agents-ui && pnpm run typecheck && pnpm run lint && pnpm run test`
- [ ] T055 If a public API route changed, run the OpenAPI export/check workflow and update `services/agents-api/openapi.json` plus `services/agents-ui/src/api/generated.ts` only through the owning generator
- [ ] T056 Perform a manual end-to-end smoke test in a runner environment: start a session, generate output, reconnect within retained offset, restart/continue, reattach after epoch bump, and verify input reaches the fresh process

## Dependencies

- Phase 1 before all implementation.
- Phase 2 before user-story work because stable ids, epoch fields, transcript storage, and guard semantics are shared.
- US1 is the minimum shippable slice and must land before US2/US3 behavior can be meaningful.
- US2 depends on US1 gateway resume/snapshot and API restart/continue mechanics.
- US3 depends on the transcript store and offset bounds from Phase 2/US1.
- UI tasks T024-T027 depend on gateway/API frame semantics but can be developed against tests once the contract is stable.
- Validation tasks T052-T056 run after the relevant implementation and tests are complete.

## Parallel Example

```text
T005 [FR-002] Gateway config
T009 [FR-005] API domain epoch field
T024 [US1] UI cursor tracking
```

These touch different services and can proceed in parallel after T001-T002, provided the additive websocket contract remains unchanged.
