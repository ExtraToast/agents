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

## T01-agents-api-credential-foundation: Agents API credential ingest, auth, validity, and status
<!-- council-task-id: T01-agents-api-credential-foundation -->
```json
{
  "boundaries": "Do not touch Phase A migration V17 except as read-only context. Do not edit services/agents-api/openapi.json or services/agents-ui/src/api/generated.ts; contract regeneration is a separate task. Do not touch workspace ownership, Fabric8AgentRunnerOrchestrator, agent-runner, agents-ui workspace pane files, or personal-stack-2. Keep the internal credentials endpoint hidden from browser OpenAPI unless the existing codebase proves internal endpoints are documented.",
  "depends_on": [],
  "deps": [],
  "difficulty": "hard",
  "id": "T01-agents-api-credential-foundation",
  "model": "sonnet",
  "objective": "Implement the serialized agents-api foundation for 025-B. Inspect the current migration directory before adding a new migration. Change agent_oauth_credentials.token_valid to nullable and update AgentOauthCredential, AgentCredentialStore, and JooqAgentCredentialStore so fresh upserts store valid=null and validated_at=null. Add a route-specific credential-ingest internal bearer separate from githubAppTokenBearer. Add hidden POST /api/v1/internal/credentials with request body userId, provider, payload, updatedBy; accept providers CLAUDE/CODEX, require Claude payload oauth_token and Codex payload auth_json/config_toml, never log or return payload values, and upsert AgentOauthCredential explicitly. Add CredentialValidator with VALID, EXPLICIT_INVALID, UNKNOWN semantics; mark false only on explicit 401/403, mark true only on verified success, leave null for unknowns and never throw validator failures into the request path. Update GET /api/v1/credentials/status to read AgentCredentialStore.statusFor(X-User-Id) and return both providers with browser-safe fields that distinguish absent, unvalidated, usable, and invalid. Update OpenApiSpecExportTest wiring and assert the internal credential endpoint is absent from OpenAPI while the browser status endpoint remains present.",
  "output_format": "Implementation commit touching only agents-api credential/auth/status foundation files, with tests for nullable validity, bearer isolation, ingest validation, validator result mapping, status scoping, OpenAPI hidden/internal behavior, and no secret payload exposure.",
  "paths": [
    "services/agents-api/src/main/resources/db/migration",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/model/AgentOauthCredential.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/port/AgentCredentialStore.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/persistence/JooqAgentCredentialStore.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/SecurityConfig.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/AgentRuntimeProperties.kt",
    "services/agents-api/src/main/resources/application.yml",
    "services/agents-api/src/main/resources/application-prod.yml",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/CredentialController.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/InternalCredentialController.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/dto/CredentialDtos.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/credentials",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/config",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/CredentialControllerTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/InternalCredentialControllerTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/credentials",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/persistence/JooqAgentCredentialStoreIntegrationTest.kt",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/contract/OpenApiSpecExportTest.kt"
  ],
  "title": "Agents API credential ingest, auth, validity, and status",
  "verify": "./gradlew :services:agents-api:test :services:agents-api:integrationTest :services:agents-api:detekt :services:agents-api:ktlintCheck :services:agents-api:jacocoTestCoverageVerification :services:agents-api:exportOpenApiSpec"
}
```

## T02-agents-api-workspace-owner: Workspace owner persistence and create scoping
<!-- council-task-id: T02-agents-api-workspace-owner -->
```json
{
  "boundaries": "Do not edit credential ingest/status files except for compile fallout from dependencies. Do not edit Fabric8AgentRunnerOrchestrator, agent-runner, agents-ui, openapi.json, generated.ts, or personal-stack-2. Keep ownerUserId nullable with defaults to minimize fixture churn, but add focused assertions that X-User-Id is used on create.",
  "depends_on": [
    "T01-agents-api-credential-foundation"
  ],
  "deps": [],
  "difficulty": "hard",
  "id": "T02-agents-api-workspace-owner",
  "model": "sonnet",
  "objective": "Implement 025-C workspace ownership after the credential foundation. Add the next unused Flyway migration for nullable workspaces.owner_user_id. Add ownerUserId: String? = null to Workspace and CreateWorkspaceCommand. Update WorkspaceController.create to require X-User-Id and pass it into CreateWorkspaceCommand. Persist/load owner_user_id in JooqWorkspaceRepository and query mappings, including onConflict/save paths that must not erase owner_user_id on unrelated updates. Add tests for controller create setting owner from the header, legacy null owner rows, repository round-trip, and update preserving existing owner.",
  "output_format": "Implementation commit for workspace owner schema/domain/controller/persistence with focused unit and integration tests.",
  "paths": [
    "services/agents-api/src/main/resources/db/migration",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/model/Workspace.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/query/GetWorkspaceQueryService.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/query/ListWorkspacesQueryService.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/persistence/JooqWorkspaceRepository.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/WorkspaceController.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/dto/WorkspaceDtos.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/domain/model/WorkspaceTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/application/command",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/WorkspaceControllerTest.kt",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/persistence/JooqWorkspaceRepositoryIntegrationTest.kt",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/flow"
  ],
  "title": "Workspace owner persistence and create scoping",
  "verify": "./gradlew :services:agents-api:test :services:agents-api:integrationTest :services:agents-api:detekt :services:agents-api:ktlintCheck :services:agents-api:jacocoTestCoverageVerification :services:agents-api:exportOpenApiSpec"
}
```

## T03-agents-api-runner-credential-injection: Per-workspace Kubernetes credential injection
<!-- council-task-id: T03-agents-api-runner-credential-injection -->
```json
{
  "boundaries": "Do not edit CredentialController, CredentialDtos, WorkspaceController, workspace persistence, openapi.json, generated.ts, agent-runner, agents-ui, or personal-stack-2. Do not put secret values in labels, annotations, logs, exception messages, test names, snapshots, or DTOs.",
  "depends_on": [
    "T01-agents-api-credential-foundation",
    "T02-agents-api-workspace-owner"
  ],
  "deps": [],
  "difficulty": "hard",
  "id": "T03-agents-api-runner-credential-injection",
  "model": "sonnet",
  "objective": "Implement 025-C runner injection in Fabric8AgentRunnerOrchestrator. Inject AgentCredentialStore, resolve workspace.ownerUserId at provision, load current owner credentials for Claude and Codex, and create/update a per-workspace Opaque Secret only when at least one required payload is present. Use this exact contract: Secret name based on the workspace like agent-runner-credentials-<short>; keys claude_oauth_token, codex_auth_json, codex_config_toml; env CLAUDE_CODE_OAUTH_TOKEN from claude_oauth_token; read-only mount /var/run/secrets/agents/credentials; env AGENT_CODEX_AUTH_JSON_FILE=/var/run/secrets/agents/credentials/codex_auth_json and AGENT_CODEX_CONFIG_TOML_FILE=/var/run/secrets/agents/credentials/codex_config_toml. Do not mount over /home/agent/.codex or /home/agent/.claude. Remove cluster-wide agents-claude-oauth dependency and related AgentRuntimeProperties fields. Provisioning must best-effort skip on missing owner, missing credential, invalid/unknown credential if local policy requires it, or store read failure. Delete the per-workspace credential Secret in destroy(); document and test whether scaleDown retains it for wake-up.",
  "output_format": "Implementation commit for orchestrator injection and lifecycle cleanup with Fabric8 integration tests for owner credential injection, missing owner/credential skip, Codex mount path, Claude env projection, reprovision update, scaleDown retention decision, destroy cleanup, and no cluster-wide OAuth fallback.",
  "paths": [
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/k8s/Fabric8AgentRunnerOrchestrator.kt",
    "services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/AgentRuntimeProperties.kt",
    "services/agents-api/src/main/resources/application.yml",
    "services/agents-api/src/main/resources/application-prod.yml",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/k8s/Fabric8AgentRunnerOrchestratorIntegrationTest.kt",
    "services/agents-api/src/integrationTest/kotlin/com/jorisjonkers/personalstack/agents/k8s/K3sTestSupport.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/config/AgentRuntimePropertiesBindingTest.kt",
    "services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/k8s"
  ],
  "title": "Per-workspace Kubernetes credential injection",
  "verify": "./gradlew :services:agents-api:test :services:agents-api:integrationTest :services:agents-api:detekt :services:agents-api:ktlintCheck :services:agents-api:jacocoTestCoverageVerification"
}
```

## T04-agent-runner-boot-credential-rewrite: Agent runner entrypoint credential rewrite
<!-- council-task-id: T04-agent-runner-boot-credential-rewrite -->
```json
{
  "boundaries": "Consume the fixed injection contract exactly: CLAUDE_CODE_OAUTH_TOKEN, AGENT_CODEX_AUTH_JSON_FILE, AGENT_CODEX_CONFIG_TOML_FILE. Do not edit Fabric8AgentRunnerOrchestrator or any Kotlin, UI, generated, or personal-stack-2 files. Never print secret values in self-tests or diagnostics.",
  "depends_on": [],
  "deps": [],
  "difficulty": "moderate",
  "id": "T04-agent-runner-boot-credential-rewrite",
  "model": "haiku",
  "objective": "Implement 025-D in services/agent-runner. At boot, if CLAUDE_CODE_OAUTH_TOKEN is set, mkdir -p ~/.claude and rewrite ~/.claude/.credentials.json in the Claude Code OAuth shape with restrictive permissions so stale PVC credentials cannot win. If AGENT_CODEX_AUTH_JSON_FILE and/or AGENT_CODEX_CONFIG_TOML_FILE point at existing files, copy them into CODEX_HOME/auth.json and CODEX_HOME/config.toml before later managed Codex setup runs. Keep behavior idempotent and no-op when env vars or files are absent. Extend the existing AGENT_RUNNER_ENTRYPOINT_SELF_TEST coverage for Claude rewrite, Codex copies, idempotency, unset no-op behavior, and no token output.",
  "output_format": "Implementation commit for entrypoint.sh and existing self-test harness only.",
  "paths": [
    "services/agent-runner/entrypoint.sh",
    "services/agent-runner/Dockerfile"
  ],
  "title": "Agent runner entrypoint credential rewrite",
  "verify": "AGENT_RUNNER_ENTRYPOINT_SELF_TEST=1 bash services/agent-runner/entrypoint.sh"
}
```

## T05-agents-ui-workspace-pane-026: Workspace pane reconnecting state, version refresh, setup cleanup, and icons
<!-- council-task-id: T05-agents-ui-workspace-pane-026 -->
```json
{
  "boundaries": "Do not edit services/agents-ui/src/api/generated.ts, services/agents-ui/src/features/credentials, agents-api, agent-runner, or personal-stack-2. Do not add external icon fetches. Do not split workspace component tests across other parallel UI tasks.",
  "depends_on": [],
  "deps": [],
  "difficulty": "hard",
  "id": "T05-agents-ui-workspace-pane-026",
  "model": "sonnet",
  "objective": "Implement all of spec 026 as one coordinated agents-ui patch. Add reconnecting to RestartSessionState. Map ApiError 503 with runnerStatus not_ready_after_provision to reconnecting instead of failed, keep 409 as reattaching, and keep non-booting errors failed. Add a bounded timeout or subsequent-error path so reconnecting cannot hang forever. Extend the existing sessionStatuses/workspaceRunnerStatuses refresh-on-connect path to refresh active workspace runnerImage, clear reconnecting/live restart state for the affected session on rebind/RUNNING, and avoid a duplicate WorkspaceView connection watcher. Remove setup picker/options/diff clutter from WorkspaceView and simplify restart confirmation so it no longer requires loadSetupPreview or operator-selected target setup fields. Delete unused UI-only setup state/actions only after rg proves they are unused outside the removed pane. Add local Claude Code and Codex SVG assets and render them in AgentKindPicker, SessionStatusChip, and SessionTabs where appropriate with accessible labels in pickers and aria-hidden decorative icons where the chip/tab already has a complete accessible name. Add a neutral fallback for SHELL/unknown and tests for all behavior.",
  "output_format": "Single agents-ui implementation commit for 026 with updated component/store tests.",
  "paths": [
    "services/agents-ui/src/features/workspaces/stores/workspaces.ts",
    "services/agents-ui/src/features/workspaces/stores/sessionStatuses.ts",
    "services/agents-ui/src/features/workspaces/stores/workspaceRunnerStatuses.ts",
    "services/agents-ui/src/features/workspaces/views/WorkspaceView.vue",
    "services/agents-ui/src/features/workspaces/components/AgentKindPicker.vue",
    "services/agents-ui/src/features/workspaces/components/SessionStatusChip.vue",
    "services/agents-ui/src/features/workspaces/components/SessionStatusRail.vue",
    "services/agents-ui/src/features/workspaces/components/SessionTabs.vue",
    "services/agents-ui/src/features/workspaces/components/SessionSetupPicker.vue",
    "services/agents-ui/src/features/workspaces/components/SessionSetupDiff.vue",
    "services/agents-ui/src/features/workspaces/assets",
    "services/agents-ui/src/features/workspaces/__tests__"
  ],
  "title": "Workspace pane reconnecting state, version refresh, setup cleanup, and icons",
  "verify": "pnpm --filter @extratoast/agents-ui typecheck && pnpm --filter @extratoast/agents-ui lint && pnpm --filter @extratoast/agents-ui test && pnpm --filter @extratoast/agents-ui contract:check"
}
```

## T06-contract-regeneration: Regenerate browser contracts
<!-- council-task-id: T06-contract-regeneration -->
```json
{
  "boundaries": "Do not hand-edit generated content. Do not edit backend source, UI source outside generated.ts, tests, runner, or personal-stack-2. Use pnpm from repo root, not npm inside services/agents-ui.",
  "depends_on": [
    "T01-agents-api-credential-foundation",
    "T02-agents-api-workspace-owner"
  ],
  "deps": [],
  "difficulty": "moderate",
  "id": "T06-contract-regeneration",
  "model": "haiku",
  "objective": "After agents-api credential/status and workspace create changes are complete, regenerate browser-visible contracts. Run the documented agents-api OpenAPI export and agents-ui contract generation from the repository root. Commit services/agents-api/openapi.json and services/agents-ui/src/api/generated.ts together. Verify the hidden internal POST /api/v1/internal/credentials endpoint is absent from openapi.json, while GET /api/v1/credentials/status and workspace create metadata reflect the implemented public contract.",
  "output_format": "Generated contract-only commit containing openapi.json and generated.ts plus any minimal generated banner update required by the repo tooling.",
  "paths": [
    "services/agents-api/openapi.json",
    "services/agents-ui/src/api/generated.ts"
  ],
  "title": "Regenerate browser contracts",
  "verify": "./gradlew :services:agents-api:exportOpenApiSpec && pnpm --filter @extratoast/agents-ui contract:generate && pnpm --filter @extratoast/agents-ui contract:check && ! rg -q '\"/api/v1/internal/credentials\"' services/agents-api/openapi.json"
}
```

## T07-agents-ui-credential-status: Agents UI credential status from Postgres contract
<!-- council-task-id: T07-agents-ui-credential-status -->
```json
{
  "boundaries": "Do not edit generated.ts, workspace pane files, agents-api, agent-runner, or personal-stack-2. Do not display or log any credential payload fields.",
  "depends_on": [
    "T06-contract-regeneration"
  ],
  "deps": [],
  "difficulty": "moderate",
  "id": "T07-agents-ui-credential-status",
  "model": "haiku",
  "objective": "Update the agents-ui credentials feature for the new browser-facing status shape after generated types are available. Remove Vault wording and any old version/schemaVersion assumptions. Treat exists=false as absent, valid=null as stored but unvalidated, valid=true as usable/connected, and valid=false as explicit re-login needed. Keep payloads impossible to display. Update credentials store/service/types/components and tests.",
  "output_format": "Agents-ui credentials feature commit with updated status semantics, copy, and tests.",
  "paths": [
    "services/agents-ui/src/features/credentials/types/index.ts",
    "services/agents-ui/src/features/credentials/services/credentialsService.ts",
    "services/agents-ui/src/features/credentials/stores/credentials.ts",
    "services/agents-ui/src/features/credentials/components/CredentialsPanel.vue",
    "services/agents-ui/src/features/credentials/__tests__/credentials.store.test.ts",
    "services/agents-ui/src/features/credentials/__tests__/CredentialsPanel.test.ts"
  ],
  "title": "Agents UI credential status from Postgres contract",
  "verify": "pnpm --filter @extratoast/agents-ui typecheck && pnpm --filter @extratoast/agents-ui lint && pnpm --filter @extratoast/agents-ui test && pnpm --filter @extratoast/agents-ui contract:check"
}
```
