# Implementation Plan: 024-continue-workspace-updated-agent-runner

**Branch**: `024-continue-workspace-updated-agent-runner` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-continue-workspace-updated-agent-runner/spec.md`

## Summary

Let an operator move a live workspace onto a newer agent-runner image while continuing the session, and auto-recycle idle behind-image runners. Runner Pods already run `agent-runner:latest` with `imagePullPolicy: Always`, so recreating the Pod re-pulls the current digest — the gap is that no path recreates the Pod when the runner is otherwise "ready" (session restart reuses the Pod when setup id/version/generation match), and staleness is judged by the agents-api digest, not the agent-runner image. Approach: stamp the runner's resolved image digest, detect "behind" relative to the freshest observed runner digest, add a force-recreate "upgrade runner" action that reuses the existing restart-and-continue revival, extend the idle sweep, and surface a plain runner-image status in the UI.

## Technical Context

**Language/Version**: Kotlin (Spring Boot, agents-api), TypeScript/Vue 3 (agents-ui)
**Primary Dependencies**: Spring Boot, fabric8 Kubernetes client, jOOQ/Postgres (workspaces), Vue 3 + Pinia + Vitest
**Storage**: Postgres (workspace + session rows); runtime runner state read from the Kubernetes API
**Testing**: Gradle (`:services:agents-api:test`, JUnit/MockK), Vitest (`pnpm test`) + @vue/test-utils
**Target Platform**: k3s (agents-system namespace); agents-api orchestrates per-workspace runner Pods
**Project Type**: mixed (JVM service + Vue UI), agents repo only
**Performance Goals**: upgrade completes within a normal cold-runner start; detection adds no extra registry round-trip
**Constraints**: agents repo only; keep `:latest` + Always-pull (no personal-stack Flux/digest-pin change); reuse the existing restart-and-continue binder; ≥80% jacoco for agents-api
**Scale/Scope**: a handful of concurrent runner Pods per namespace; one runner per workspace

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Claude/Codex parity is preserved — feature is provider-agnostic at the runner-image level (Codex sessions ride the same recycle); spec scopes credential specifics to Claude but the image-upgrade mechanism is shared
- [x] Rendered artifacts are updated by the owning renderer — agents-api `openapi.json` + agents-ui `generated.ts` regenerated if a typed DTO/operation is added
- [x] Small stacked PR boundary is clear — agents-api (detection + endpoint + lifecycle + idle sweep) then agents-ui (store + SessionStatusRail); no unrelated cleanup
- [x] Verification command identified — `:services:agents-api:test` + `ktlintCheck`; `pnpm typecheck && pnpm lint && pnpm test` in agents-ui; live recycle check post-deploy

## Project Structure

### Documentation

```text
specs/024-continue-workspace-updated-agent-runner/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/upgrade-runner.md
`-- tasks.md
```

### Source Code (paths this feature touches)

```text
services/agents-api/src/main/kotlin/.../infrastructure/k8s/
    Fabric8AgentRunnerOrchestrator.kt   # stamp + read runner-image digest; freshest-observed; force provision
    RunnerState.kt                      # add runnerImageDigest field
services/agents-api/src/main/kotlin/.../application/workspacerunner/
    WorkspaceRunnerLifecycleService.kt  # upgradeRunner(workspaceId) — force recreate + continue
    IdleScaleDownScheduler.kt           # recycle idle runners behind the freshest runner image
services/agents-api/src/main/kotlin/.../application/sessionbinding/
    RunnerSessionBinder.kt              # reuse restart() / forceProvisionAndWait for the upgrade
services/agents-api/src/main/kotlin/.../infrastructure/web/
    WorkspaceController.kt              # POST /workspaces/{id}/runner/upgrade
    dto/WorkspaceDtos.kt                # runnerImage { digest, upgradeAvailable } on workspace response
services/agents-api/src/main/kotlin/.../domain/port/
    AgentRunnerOrchestrator.kt          # expose freshest-observed digest + runner digest
services/agents-ui/src/features/workspaces/
    services/workspaceService.ts        # upgradeRunner(workspaceId)
    stores/workspaces.ts                # upgradeRunner action -> reattach/replay states
    components/SessionStatusRail.vue    # runner-image status + "Update runner" button
    types/index.ts                      # runnerImage on the workspace type
```

**Structure Decision**: All work is in the agents repo. agents-api owns detection, the upgrade action, the DTO, and the idle-sweep change; agents-ui owns the operator control and the status presentation. No personal-stack change.

## Phase 0: Outline & Research

Resolved (see `research.md`): how to identify the runner image without registry credentials (freshest-observed-digest), why a force flag is needed (ready-but-behind short-circuit), and the reuse of the restart-and-continue binder. No open NEEDS CLARIFICATION (auto-upgrade resolved in spec: in scope).

## Phase 1: Design & Contracts

- `data-model.md`: runner-image digest on RunnerState/Workspace projection; `upgradeAvailable` derivation; no new persisted columns required (digest read from the Kubernetes API at request time; `upgradeAvailable` derived).
- `contracts/upgrade-runner.md`: `POST /api/v1/workspaces/{id}/runner/upgrade` request/response + the `runnerImage` field added to the workspace response.
- `quickstart.md`: how to validate (recreate onto newer digest, conversation resumes, idle auto-recycle, indicator accuracy).

## Phase 2: Task Planning Approach

`/speckit.tasks` should produce ordered tasks: (1) orchestrator digest stamping + freshest-observed + RunnerState/port + tests; (2) lifecycle `upgradeRunner` reusing the binder + force flag + tests; (3) controller endpoint + DTO `runnerImage` + openapi regen + controller tests; (4) idle-sweep runner-image recycle with guards + tests; (5) agents-ui service+store action + tests; (6) SessionStatusRail status + button + tests + generated.ts regen; (7) end-to-end deploy + live verification. Backend before UI; each layer independently testable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Freshest-observed-digest heuristic instead of a registry query | agents-api has no registry credentials and querying ghcr per request is heavy | A true "is :latest newer" check needs registry auth + network; the explicit upgrade action does not depend on detection, and relative-staleness surfaces a new image as soon as one runner re-provisions |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete
- [x] Phase 1: Design complete
- [x] Phase 2: Task planning approach complete

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
