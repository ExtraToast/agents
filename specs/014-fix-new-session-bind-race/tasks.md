# Tasks: {{FEATURE_NAME}}

**Input**: Design documents from `/specs/{{FEATURE_NAME}}/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks because it touches different files
- **[Story]**: User story label, for example US1, US2, US3
- Include exact file paths in descriptions

## Phase 1: Setup

- [ ] T001 Create or verify project structure for this feature
- [ ] T002 Identify the smallest validation command for touched area

## Phase 2: Foundational

- [ ] T003 Implement shared models/configuration needed by all stories
- [ ] T004 Add or update base tests for cross-story behavior

## Phase 3: User Story 1 (Priority: P1)

**Goal**: [Brief value delivered by this story]

**Independent Test**: [How to verify only this story]

- [ ] T005 [US1] Implement [specific behavior] in [path]
- [ ] T006 [US1] Add focused tests in [path]

## Phase 4: User Story 2 (Priority: P2)

**Goal**: [Brief value delivered by this story]

**Independent Test**: [How to verify only this story]

- [ ] T007 [P] [US2] Implement [specific behavior] in [path]
- [ ] T008 [P] [US2] Add focused tests in [path]

## Phase 5: User Story 3 (Priority: P3)

**Goal**: [Brief value delivered by this story]

**Independent Test**: [How to verify only this story]

- [ ] T009 [P] [US3] Implement [specific behavior] in [path]
- [ ] T010 [P] [US3] Add focused tests in [path]

## Phase 6: Polish

- [ ] T011 Run the validation command identified in plan.md
- [ ] T012 Update docs or runbooks affected by this feature

## Dependencies

- Setup before foundational work
- Foundational work before user stories
- User stories may proceed in priority order, unless marked independent and parallel
- Polish after desired stories are complete

## Parallel Example

```text
T007 [P] [US2] ...
T009 [P] [US3] ...
```

<!-- council-tasks-format: v1 -->

## T1-spec: Author spec with conflict-source enumeration
<!-- council-task-id: T1-spec -->
```json
{
  "boundaries": "Owns only specs/014-fix-new-session-bind-race/spec.md. Read-only everywhere else. Does not edit any source, contract, or frontend file. Must not influence spec numbering from feat/capacitor-scaffold (016/018/020/021/022 do not exist on origin/main).",
  "depends_on": [],
  "difficulty": "hard",
  "id": "T1-spec",
  "model": "sonnet",
  "objective": "The council spec-kit artifacts ALREADY EXIST at specs/014-fix-new-session-bind-race/ (spec.md, plan.md, tasks.md) in your worktree, copied from the consolidated plan. Do NOT allocate a new spec number and do NOT create a parallel spec dir or bump to 015+ even though 014 already exists — 014 IS this work. AUGMENT the existing specs/014-fix-new-session-bind-race/spec.md in place, using specs/013-repair-session-runner-boot/spec.md only as a structural reference. The spec MUST include: Outcomes, Non-Goals, Open Questions, and a conflict-source taxonomy table. Enumerate (read-only) every RunnerSessionBindingResult.Conflict source and every session-row mutator / ensureBound caller (websocket unknown-agent close at SessionAttachHandler.kt:166, any scheduled/admin/reaper services, restart) to PROVE which paths can touch a brand-new STARTING row during the spawn window \u2014 record findings, do not merely assert 'no reconciler'. Document the decisions: structural spawn-then-persist-as-bound fix in startInternal only; defensive Conflict->503 for start (no 202, no 422); SendUserInput 409 left intact (out-of-scope unless reproduced); StageAgentInputCommandHandler removal (dead code, never dispatched \u2014 controller stageInput calls gateway directly); accepted UUID-collision-on-upsert risk; deployment via release-tag + personal-stack manifest bump. Leave the production root-cause as explicit open questions. No source-code edits.",
  "output_format": "A new file specs/014-fix-new-session-bind-race/spec.md with the sections above. Commit on the new branch off origin/main.",
  "paths": [
    "specs/014-fix-new-session-bind-race/spec.md"
  ],
  "title": "Author spec with conflict-source enumeration",
  "verify": "test -f specs/014-fix-new-session-bind-race/spec.md && grep -qi 'non-goal' specs/014-fix-new-session-bind-race/spec.md && grep -qi 'outcome' specs/014-fix-new-session-bind-race/spec.md && grep -qi 'open question' specs/014-fix-new-session-bind-race/spec.md"
}
```

## T2-backend: Structural startInternal fix + handler mapping + dead-code removal + Kotlin tests
<!-- council-task-id: T2-backend -->
```json
{
  "boundaries": "Owns RunnerSessionBinder.kt, StartAgentSessionCommandHandler.kt, AgentSessionController.kt (annotation only), the three StageAgentInput* files (deleted), and the four Kotlin test files listed. Must NOT edit openapi.json, generated.ts, any frontend file, WorkspaceAgentSessionRepository.kt, JooqWorkspaceAgentSessionRepository.kt, SendUserInputCommandHandler.kt, ensureBoundInternal/restartInternal logic, or spawnAndBind's signature/body.",
  "depends_on": [
    "T1-spec"
  ],
  "difficulty": "hard",
  "id": "T2-backend",
  "model": "sonnet",
  "objective": "Implement the source fix in RunnerSessionBinder.startInternal ONLY: keep checkBindingReadiness (~line 70) BEFORE any persistence (genuine cold-start returns Unavailable/503 with no row created); spawn the gateway agent first using the stable session id, then persist the session already RUNNING and bound (gatewayAgentId set) in a SINGLE sessions.save write (the existing UPSERT save at JooqWorkspaceAgentSessionRepository accepts RUNNING+gatewayAgentId in one write \u2014 do NOT add a new repository method); on persistence failure, stop the spawned gateway agent and return Unavailable (no STARTING row left behind). Do NOT modify spawnAndBind, ensureBoundInternal, or restartInternal \u2014 restart must still return Conflict for a stale expectedGeneration. Add CAS-miss instrumentation at the bind-failure site (log current row generation/status/gatewayAgentId when bindIfGeneration returns 0 rows). In StartAgentSessionCommandHandler keep a defensive Conflict->AgentRunnerUnavailableException(503) remap (now unreachable on happy path). Leave SendUserInputCommandHandler unchanged. Remove the DEAD StageAgentInputCommand + StageAgentInputCommandHandler + StageAgentInputCommandHandlerTest (confirmed never dispatched; controller stageInput calls the gateway directly). Add @ApiResponses(201 success, 503 ProblemDetail) to AgentSessionController.start() mirroring restart() \u2014 NO 202, NO 422. Tests: (a) in RunnerSessionBindingServiceTest.kt add a regression that simulates the production race (force the bind CAS to miss) and asserts a new session resolves Bound, asserts no lingering STARTING row after a residual persistence failure, and asserts start never returns Conflict \u2014 this must FAIL on 02110db and PASS after; (b) in AgentSessionControllerTest.kt add an HTTP-level test wiring a REAL SpringCommandBus + real StartAgentSessionCommandHandler (mocked binding service) plus the production GlobalExceptionHandler and AgentRunnerUnavailableExceptionHandler, asserting start maps to 201 (and 503 only for genuine Unavailable), never 409; (c) assert restart still returns 409 for stale expectedGeneration; (d) update StartAgentSessionCommandHandlerTest to assert no IllegalStateException('session generation conflict'). Do NOT regenerate openapi.json/generated.ts (separate task). Match surrounding Kotlin style.",
  "output_format": "Edited Kotlin source + tests, dead handler/command/test deleted, @ApiResponses added. Committed on the spec branch.",
  "paths": [
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/sessionbinding/RunnerSessionBinder.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/StartAgentSessionCommandHandler.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/AgentSessionController.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/StageAgentInputCommand.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/StageAgentInputCommandHandler.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/command/StageAgentInputCommandHandlerTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/sessionbinding/RunnerSessionBindingServiceTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/command/StartAgentSessionCommandHandlerTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/AgentSessionControllerTest.kt"
  ],
  "title": "Structural startInternal fix + handler mapping + dead-code removal + Kotlin tests",
  "verify": "./gradlew :services:agents-api:test --tests \"*RunnerSessionBindingServiceTest\" --tests \"*StartAgentSessionCommandHandlerTest\" --tests \"*AgentSessionControllerTest\""
}
```

## T3-contract: Regenerate OpenAPI spec and UI types
<!-- council-task-id: T3-contract -->
```json
{
  "boundaries": "Owns ONLY openapi.json and generated.ts (both are generated outputs). Must not hand-edit either nor touch any Kotlin/Vue source. Requires a gradle-capable environment; if gradle cannot run in the worker sandbox, this is CI's responsibility and the worker must report the blockage rather than fabricate output.",
  "depends_on": [
    "T2-backend"
  ],
  "difficulty": "moderate",
  "id": "T3-contract",
  "model": "sonnet",
  "objective": "After the backend @ApiResponses change is present, regenerate the contract in a GRADLE-CAPABLE environment (CI or a gradle-capable worker \u2014 NOT a Codex worker, since exportOpenApiSpec boots springdoc and binds a socket). Run ./gradlew :services:agents-api:exportOpenApiSpec then pnpm --filter @extratoast/agents-ui contract:generate. Commit services/agents-api/openapi.json and services/agents-ui/src/api/generated.ts together. Never hand-edit openapi.json. Confirm the POST /workspaces/{id}/sessions operation now advertises 201 and 503.",
  "output_format": "Updated services/agents-api/openapi.json and services/agents-ui/src/api/generated.ts, committed together.",
  "paths": [
    "services/agents-api/openapi.json",
    "services/agents-ui/src/api/generated.ts"
  ],
  "title": "Regenerate OpenAPI spec and UI types",
  "verify": "cd services/agents-ui && npm run contract:check"
}
```

## T4-frontend: Graceful create-session handling and retry vocabulary
<!-- council-task-id: T4-frontend -->
```json
{
  "boundaries": "Owns only the four workspaces feature files and three test files listed. Must not edit generated.ts, openapi.json, sessionStatuses.ts, or any backend file. Retry vocabulary must match the labels emitted by the backend, not invent new ones.",
  "depends_on": [
    "T3-contract"
  ],
  "difficulty": "moderate",
  "id": "T4-frontend",
  "model": "sonnet",
  "objective": "In services/agents-ui/src/features/workspaces/: (1) ensure no raw 'ApiError: session generation conflict' reaches the console; give WorkspaceView.onSpawn() (currently swallows in a bare catch) an explicit user-facing error state or toast instead of silent swallow. (2) Reconcile workspaceService.ts RETRYABLE_RUNNER_STATUSES (today {Pending, ContainerCreating, PodInitializing}) with the actual backend RunnerUnavailableReason labels (boot_lease_held, setup_operation_in_progress, not_ready_after_provision, provision_failed, workspace_not_found) so transient startup 503s retry and non-retryable ones fail fast \u2014 do not let create-session burn the full 180s SESSION_START_BUDGET_MS on a deterministic failure, and do not repost on a non-retryable status (avoid minting leaking UUIDs). (3) Update the EXISTING tests (they already exist \u2014 do not create parallel files): startSession.retry.test.ts (retryable runner 503, non-retryable 503 not retried, 409 not retried), workspaces.store.test.ts (in-flight state cleared, snapshot refresh without reconnect loop), WorkspaceView.test.ts (no raw ApiError escapes the view). Match existing TS/Vue style.",
  "output_format": "Edited workspaceService.ts, workspaces.ts store, WorkspaceView.vue, and the three existing test files. Committed on the spec branch.",
  "paths": [
    "services/agents-ui/src/features/workspaces/services/workspaceService.ts",
    "services/agents-ui/src/features/workspaces/stores/workspaces.ts",
    "services/agents-ui/src/features/workspaces/views/WorkspaceView.vue",
    "services/agents-ui/src/features/workspaces/__tests__/startSession.retry.test.ts",
    "services/agents-ui/src/features/workspaces/__tests__/workspaces.store.test.ts",
    "services/agents-ui/src/features/workspaces/__tests__/WorkspaceView.test.ts"
  ],
  "title": "Graceful create-session handling and retry vocabulary",
  "verify": "cd services/agents-ui && npm run typecheck && npm run lint && npm run test"
}
```

## T5-deploy: Deployment/rollout reconciliation note
<!-- council-task-id: T5-deploy -->
```json
{
  "boundaries": "Owns only specs/014-fix-new-session-bind-race/rollout.md. Read-only everywhere else (no source, contract, or frontend edits). Does not edit spec.md (owned by T1). Any external deployment-repo change must be a separate PR, not part of this task.",
  "depends_on": [
    "T1-spec"
  ],
  "difficulty": "moderate",
  "id": "T5-deploy",
  "model": "sonnet",
  "objective": "Read-only: reconcile the live agents-api pod image digest/tag on agents.jorisjonkers.dev (via kubernetes tooling) against origin/main@02110db plus this fix. Because CI builds push:false (ci.yml:214) and only release.yml (:92) publishes, with personal-stack owning GitOps consumption of released tags (specs/004:220-222), document the exact release-tag + personal-stack manifest-bump steps required to roll THIS fix out, flag any gap, and note who owns cutting the release. Write the findings to specs/014-fix-new-session-bind-race/rollout.md for inclusion in the PR body.",
  "output_format": "A new file specs/014-fix-new-session-bind-race/rollout.md documenting the deployed digest vs main, the release-tag + manifest-bump rollout steps, and any gap.",
  "paths": [
    "specs/014-fix-new-session-bind-race/rollout.md"
  ],
  "title": "Deployment/rollout reconciliation note",
  "verify": "test -f specs/014-fix-new-session-bind-race/rollout.md && grep -qiE 'image|digest|release' specs/014-fix-new-session-bind-race/rollout.md"
}
```
