# Implementation Plan: GitHub App-only repository access

**Branch**: `025-github-app-only-repository-access` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-github-app-only-repository-access/spec.md`

## Summary

Make installing the GitHub App (`jorisjonkers-dev-agents`) the single way a
repository is wired for agent access. Remove the SSH deploy-key attach flow and
its storage/plumbing end-to-end, unify the runner's primary-repo clone onto the
already-working HTTPS + App-token credential-helper path, and give users a live
"is the App installed for this repo?" status plus a working install link on the
add and detail screens. Retain the independent branch-protection check and fold
it, with the install-status, into one repository status surface.

The runner already mints and uses installation tokens over HTTPS for push / PR /
Actions and already clones additional repos that way; the only runner change is
to route the *primary* clone through the same path and delete the SSH branch.
The backend already has the GitHub App JWT + `GET /repos/{owner}/{repo}/installation`
lookup (`GitHubAppInstallationTokenClient`); the status check reuses it without
minting a token.

## Technical Context

**Language/Version**: Kotlin (Spring Boot, JDK 21) for `agents-api`; TypeScript 5
+ Vue 3 + Vuetify/Tailwind for `agents-ui`; POSIX sh for `agent-runner`.
**Primary Dependencies**: Spring Boot, jOOQ + Flyway (PostgreSQL), Fabric8
Kubernetes client; Vue 3, Pinia, `openapi-typescript`-generated types; Vitest.
**Storage**: PostgreSQL (jOOQ/Flyway migrations under
`services/agents-api/src/main/resources/db/migration`); HashiCorp Vault KV-v2
(deploy-key secrets — being retired).
**Testing**: `./gradlew :services:agents-api:test` (JUnit/Kotlin);
`pnpm --filter agents-ui test|typecheck|lint` (Vitest); contract drift via
`./gradlew :services:agents-api:exportOpenApiSpec`.
**Target Platform**: k3s cluster; runner pods; browser UI; JVM service.
**Project Type**: mixed (service + UI + runner scripts).
**Performance Goals**: N/A — install-status is an on-demand live call; one
GitHub API round-trip per check, no polling.
**Constraints**: Installation-status check MUST NOT mint or expose a token;
SSH-form repo URLs must keep working via the runner's `insteadOf` rewrite;
existing repos (incl. legacy project-linked) must not regress.
**Scale/Scope**: Single-operator platform; a handful of repos. Scope is
deletion-heavy (remove deploy-key surface) plus one new live status endpoint and
a UI rework of the repository add/detail screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] No attribution is introduced in files, comments, commit text, or PR text.
- [x] Claude/Codex parity preserved — no agent-facing skill/hook/runner-behavior
  change beyond the credential path, which is identical for both agents (the
  runner credential helper is agent-agnostic).
- [x] Rendered artifacts updated by the owning renderer when source changes:
  `agents-api/openapi.json` is regenerated via `exportOpenApiSpec` and
  `agents-ui` types are regenerated from it after any endpoint/DTO change. No
  `fleet.yaml`/Traefik/agent-kit changes are required (no routing/exposure
  change).
- [x] Small stacked PR boundary is clear — see "PR slicing" below; each slice is
  independently revertable.
- [x] Verification command identified per area (see Technical Context / Phase 1
  quickstart).

No constitution gate is violated. Complexity Tracking is empty.

## Project Structure

### Documentation

```text
specs/025-github-app-only-repository-access/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- repositories-api.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md            # produced by /speckit.tasks
```

### Source Code (real paths this feature touches)

```text
services/agents-api/
  src/main/resources/db/migration/
    V17__drop_deploy_keys.sql                 # NEW — drop key columns
  src/main/kotlin/.../agents/
    application/command/
      AttachDeployKeyCommand.kt               # DELETE
      AttachDeployKeyCommandHandler.kt        # DELETE
      AttachRepositoryDeployKeyCommand.kt     # DELETE
      AttachRepositoryDeployKeyCommandHandler.kt  # DELETE
      CreateRepositoryCommandHandler.kt       # EDIT — stop pre-allocating vault path
    application/
      VerifyRepositoryAccess.kt               # EDIT — drop gateway read/write probe; keep branch protection
      RepositoryVerificationService.kt        # EDIT — re-check now = install-status + protection
      RepositoryInstallationStatusService.kt  # NEW — live install probe (no token mint)
    domain/model/
      Repository.kt                           # EDIT — drop deploy-key + read/write fields
      GithubLink.kt                           # EDIT — drop deploy-key fields (read-only legacy)
    domain/port/
      DeployKeyStore.kt                       # DELETE
      AgentGatewayClient.kt                    # EDIT — remove verifyAccess()
    infrastructure/integration/
      VaultDeployKeyStore.kt                  # DELETE (+ best-effort secret deletion in migration runner)
      GitHubAppInstallationTokenClient.kt     # EDIT — expose installation-lookup for status reuse
    infrastructure/web/
      RepositoryController.kt                 # EDIT — remove POST /{id}/key; repurpose /verify; add status read
      ProjectController.kt (+ legacy link key endpoints)  # EDIT — remove legacy key endpoints
      dto/RepositoryDtos.kt                   # EDIT — drop key DTOs; add status DTO; reshape verification
    infrastructure/persistence/
      JooqRepositoryRepository.kt             # EDIT — stop reading/writing dropped columns
    infrastructure/k8s/
      Fabric8AgentRunnerOrchestrator.kt       # EDIT — remove deploy-key Secret/volume/mount + fallback
    config/AgentRuntimeProperties.kt          # EDIT — remove githubDeployKeySecret usage
  openapi.json                                # REGEN via exportOpenApiSpec

services/agent-runner/
  entrypoint.sh                               # EDIT — primary clone over HTTPS; drop SSH key staging
  (gh-app credential helpers already exist; unchanged)

services/agents-ui/src/features/repositories/
  components/AttachKeyWizard.vue              # DELETE
  components/AccessStatusBadge.vue            # EDIT — render install-status + protection
  components/GitHubAppPanel.vue               # EDIT — primary CTA, live status, re-check
  components/GitHubAppReference.vue           # EDIT — drop "before attaching deploy keys" framing
  components/CreateRepositoryForm.vue         # EDIT — next-step copy
  services/githubAppLinks.ts                  # EDIT — slug -> jorisjonkers-dev-agents; sync permissions
  services/repositoriesService.ts             # EDIT — drop attachDeployKey; add fetchInstallationStatus
  stores/repositories.ts                      # EDIT — drop attachKey; add status/recheck
  views/RepositoryView.vue                    # EDIT — remove deploy-key section; show status + install
  views/RepositoriesView.vue                  # EDIT — next-step copy
  types/index.ts                              # type edits backed by regenerated contract
  __tests__/*                                 # EDIT — update/remove deploy-key tests; add status tests
services/agents-ui/src/features/projects/components/AttachKeyWizard.vue  # DELETE

docs/
  REPO_SETUP.md                               # EDIT — App-only setup; remove deploy-key instructions
services/agents-api/src/main/resources/templates/deploy-key-setup.md     # DELETE/replace with App guide
```

**Structure Decision**: Follow the existing hexagonal layout in `agents-api`
(domain model / port / application command+query / infrastructure adapter+web)
and the existing `features/repositories` slice in `agents-ui`. No new modules.
The new install-status capability is a thin application service + adapter reusing
the existing App-JWT client, exposed through the existing `RepositoryController`.

## Phase 0: Outline & Research

Unknowns are minimal because the App-token HTTPS path already runs in
production. Research captured in `research.md`:

1. **Install-status probe** — confirm `GET /repos/{owner}/{repo}/installation`
   with an App JWT is the right token-free signal, what its responses mean
   (200 = installed-and-able; 404 = not installed / repo not in installation;
   401/5xx = indeterminate), and how to reuse `GitHubAppInstallationTokenClient`'s
   JWT + lookup without minting.
2. **Primary-clone migration** — confirm entrypoint can clone the primary repo
   over HTTPS via the existing `agent-gh-app` credential helper once the
   `insteadOf` rewrite is moved ahead of the primary clone, and that
   `REPO_ALLOW` already covers the primary repo.
3. **Schema/data lifecycle** — exact columns to drop (`repositories`,
   `github_links`), which verification columns to keep (branch protection), and
   the best-effort Vault secret deletion approach during migration.
4. **Contract regeneration** — the `exportOpenApiSpec` -> `openapi.json` -> UI
   type-generation chain and the `Pipeline Complete` drift gate.

**Output**: `research.md`

## Phase 1: Design & Contracts

1. **Data model** (`data-model.md`): column drops/keeps on `repositories` and
   `github_links`; reshaped `AccessVerification` (branch-protection only);
   the live (un-stored) `InstallationStatus` value.
2. **Contracts** (`contracts/repositories-api.md`): remove `POST
   /repositories/{id}/key` and legacy project-link key endpoints; reshape `GET
   /repositories/{id}` and the re-check endpoint to carry install-status +
   branch protection; define the install-status shape (`INSTALLED`,
   `NOT_INSTALLED`, `UNKNOWN`, plus `installUrl`, `owner`, parse-failure case).
3. **Quickstart** (`quickstart.md`): end-to-end manual validation (add repo ->
   install link -> re-check flips to installed -> agent session clones/pushes via
   App) plus the per-area verification commands.
4. Re-run Constitution Check (still PASS — deletion + one endpoint, renderers
   re-run).

**Output**: `data-model.md`, `contracts/repositories-api.md`, `quickstart.md`

## Phase 2: Task Planning Approach

`/speckit.tasks` should produce ordered tasks grouped into the PR slices below,
each independently shippable and revertable (constitution V). Within a slice,
order: migration/contract first, then backend, then UI, then docs, then
verification. Mark tasks parallel-safe `[P]` only across services that don't
share a file. Every backend slice that changes an endpoint/DTO must include an
`openapi.json` regeneration task and, if the contract changed, a UI
type-regeneration task before UI work.

**Suggested PR slicing** (stacked):

- **PR1 — Runner primary clone over HTTPS.** Move `insteadOf` ahead of the
  primary clone, drop `GIT_SSH_COMMAND`/key staging in `entrypoint.sh`, and
  remove the deploy-key Secret/volume/mount + cluster fallback in the
  orchestrator. Self-contained; deploy keys still exist in DB but are unused by
  the runner. (Highest-value, unblocks everything; verify a session still
  clones/pushes.)
- **PR2 — App identity + live install-status (backend + UI read path).** Fix the
  slug to `jorisjonkers-dev-agents`, sync the displayed permissions, add the
  install-status service/endpoint reusing the App JWT, and surface live status +
  install link + re-check on the add/detail screens. Keeps the deploy-key attach
  path present but de-emphasized.
- **PR3 — Remove deploy-key attach surface.** Delete the attach commands/handlers,
  `POST /{id}/key`, legacy project-link key endpoints, `AttachKeyWizard.vue`,
  `repositoriesService.attachDeployKey`, the gateway `verifyAccess` probe; reshape
  verification to branch-protection-only. Regenerate contract + types.
- **PR4 — Drop storage + cleanup.** `V17` migration dropping key columns on
  `repositories`/`github_links` and the retired verification columns; delete
  `VaultDeployKeyStore`/`DeployKeyStore` and best-effort delete Vault secrets;
  update `REPO_SETUP.md` and replace the deploy-key setup template with the App
  guide.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| (none) | | |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete
- [x] Phase 1: Design complete
- [x] Phase 2: Task planning approach complete

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
