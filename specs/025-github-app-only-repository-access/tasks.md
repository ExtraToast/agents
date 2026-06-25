# Tasks: GitHub App-only repository access

**Input**: Design documents from `/specs/025-github-app-only-repository-access/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/repositories-api.md, quickstart.md

> **Implementation status (2026-06-24)**: PR1 complete and verified (agent-gateway
> tests green; agents-api main + test compile green). PR2 backend complete and
> verified (install-status probe/service/endpoint + unit tests green). PR2 UI,
> PR3, and PR4 are NOT yet implemented — the destructive domain/DTO/migration/
> Vault removal and the full UI rework + OpenAPI/type regeneration remain. The
> domain-model reshape was deliberately reverted to keep the tree compiling;
> resume at T014 (OpenAPI regen) then T015 onward.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no ordering dependency).
- **[Story]**: US1 (no-key add + working session), US2 (live status), US3 (cleanup + identity).
- Tasks are grouped by the plan's stacked-PR slices (constitution V). Land PRs in order PR1 → PR4.
- Verification commands: see `quickstart.md`. Backend changes that alter an endpoint/DTO MUST run `exportOpenApiSpec` and regenerate UI types before UI work.

---

## Phase 1: Setup

- [ ] T001 Confirm build env can resolve private GitHub Packages (set `GITHUB_ACTOR`/`GITHUB_TOKEN`) so `:services:agents-api:exportOpenApiSpec` and `pnpm --filter agents-ui install` succeed (see quickstart caveats).
- [ ] T002 Baseline the touched areas green before changes: `./gradlew :services:agents-api:test --no-daemon` and `pnpm --filter agents-ui test`.

---

## Phase 2: PR1 — Runner primary clone over HTTPS (US1)

**Goal**: The runner clones the primary repo over HTTPS via the App-token credential helper; no deploy-key secret is provisioned. Delivers SC-001/SC-004 at the runtime layer and unblocks the rest.

**Independent Test**: Deploy a runner from this branch, start a primary-repo session, watch the entrypoint clone the primary repo over HTTPS (no `GIT_SSH_COMMAND`) and push a commit; confirm the pod has no `github-deploy-key` volume.

- [x] T003 [US1] In `services/agent-runner/entrypoint.sh`, move the `git config --global url.https://github.com/.insteadOf ...` rewrite, credential-helper config (`credential.helper agent-gh-app`, `credential.useHttpPath true`), and App-token env setup to **before** the primary `REPO_URL` clone.
- [x] T004 [US1] In `services/agent-runner/entrypoint.sh`, clone the primary repo via the same `clone_repo_into_workspace` path used for `REPO_URLS`; remove `GIT_SSH_COMMAND`, the `/tmp/agent-deploy-key` staging, and the `~/.ssh/known_hosts` copy from the deploy-key mount.
- [x] T005 [US1] Syntax-check `sh -n services/agent-runner/entrypoint.sh`; confirm `derive_repo_allow()` still includes the primary repo in `REPO_ALLOW`.
- [x] T006 [US1] In `services/agents-api/.../infrastructure/k8s/Fabric8AgentRunnerOrchestrator.kt`, remove `ensureDeployKeySecret()`, `resolveKeyMaterial()`, `buildWorkspaceSecret()`, the `github-deploy-key` volume + mount, and the cluster-wide `agents-github-deploy-key` (`setup.githubDeployKeySecret`) fallback; stop threading `deployKeySecretName` through `applyResources`/`pod`/`podVolumes`.
- [x] T007 [US1] In `services/agents-api/.../config/AgentRuntimeProperties.kt`, remove `githubDeployKeySecret` usage now that no fallback secret is mounted (keep GitHub App props).
- [x] T008 [P] [US1] Update orchestrator tests to drop deploy-key-secret expectations and assert no `github-deploy-key` volume is added.
- [x] T009 [US1] Verify: `./gradlew :services:agents-api:test --no-daemon`; run the PR1 smoke from quickstart.

---

## Phase 3: PR2 — App identity + live install-status (US2, US1 link, US3 identity)

**Goal**: Correct App identity, sync permissions, add a token-free live install-status endpoint, and surface live status + install link + manual re-check on add/detail screens.

**Independent Test**: `GET /repositories/{id}/installation-status` returns INSTALLED for an installed owner, NOT_INSTALLED for an uninstalled one, and UNKNOWN for an unparseable URL; UI shows live status + install link + working re-check.

### Backend

- [x] T010 [US2] In `services/agents-api/.../infrastructure/integration/GitHubAppInstallationTokenClient.kt`, extract a reusable `installationStatus(repoUrl): InstallationState` that runs `appJwt()` + `GET /repos/{owner}/{repo}/installation` and maps 200→INSTALLED, 404→NOT_INSTALLED, disabled/401/403/5xx/network→UNKNOWN — **without** calling `accessToken(...)`.
- [x] T011 [US2] Add `services/agents-api/.../application/RepositoryInstallationStatusService.kt`: load the repository, parse owner, build `installUrl` (`https://github.com/apps/jorisjonkers-dev-agents/installations/new?state=<owner>`), call the client, return the `InstallationStatus` value (data-model.md). Unparseable URL → UNKNOWN with null owner/installUrl + detail.
- [x] T012 [US2] Add a status DTO in `services/agents-api/.../infrastructure/web/dto/RepositoryDtos.kt` and wire `GET /api/v1/repositories/{id}/installation-status` in `RepositoryController.kt` (no token minted). App-not-configured → UNKNOWN + detail. **(M2: this single GET serves both on-load and re-check; `POST /{id}/verify` stays branch-protection-only — see T025.)**
- [x] T013 [P] [US2] Tests: `RepositoryInstallationStatusService` (INSTALLED/NOT_INSTALLED/UNKNOWN, unparseable URL, App disabled) and controller test for the new endpoint.
- [ ] T014 [US2] Regenerate contract: `./gradlew :services:agents-api:exportOpenApiSpec --no-daemon`; commit `services/agents-api/openapi.json`.

### UI (after T014 + type regen)

- [ ] T015 [US3] In `services/agents-ui/src/features/repositories/services/githubAppLinks.ts`, change `DEFAULT_GITHUB_APP_SLUG` to `jorisjonkers-dev-agents` and sync `GITHUB_APP_REQUESTED_PERMISSIONS` to `contents/pull_requests/actions/issues/workflows:write` + `packages:read`.
- [ ] T016 [P] [US3] Update `githubAppLinks.test.ts` and `GitHubAppReference.test.ts` for the new slug + permission list; drop "before attaching deploy keys" copy in `GitHubAppReference.vue`.
- [ ] T017 [US2] Regenerate UI types from the new `openapi.json` into `services/agents-ui/src/features/repositories/types/index.ts`; add `fetchInstallationStatus(id)` to `repositoriesService.ts` and a `installationStatus` + `recheck()` action to `stores/repositories.ts`.
- [ ] T018 [US2] In `GitHubAppPanel.vue`, make the install link the primary CTA and render live install-status (INSTALLED / NOT_INSTALLED / UNKNOWN) with a **Re-check** button (re-check simply re-calls `GET /{id}/installation-status`); show the parse-failure message when owner is null; preserve the existing permission-approval note (FR-014).
- [ ] T019 [US1] In `views/RepositoryView.vue` and `views/RepositoriesView.vue`, change the post-add next-step copy from "Attach a deploy key next…" to the App install flow; surface install-status on add and detail.
- [ ] T020 [P] [US2] UI tests: status states render correctly, re-check calls the service, install link resolves to `jorisjonkers-dev-agents`; update `RepositoryView.test.ts` / `RepositoriesView.test.ts`.
- [ ] T021 [US2] Verify: `pnpm --filter agents-ui typecheck && lint && test`; run the PR2 smoke from quickstart.

---

## Phase 4: PR3 — Remove deploy-key attach surface (US1)

**Goal**: No path anywhere accepts or attaches deploy keys; access-verification becomes branch-protection-only.

**Independent Test**: `POST /repositories/{id}/key` returns 404; no attach wizard exists; `verify` returns branch-protection-only.

### Backend

- [ ] T022 [US1] Delete `AttachDeployKeyCommand.kt`, `AttachDeployKeyCommandHandler.kt`, `AttachRepositoryDeployKeyCommand.kt`, `AttachRepositoryDeployKeyCommandHandler.kt` under `services/agents-api/.../application/command/`.
- [ ] T023 [US1] In `RepositoryController.kt`, remove `POST /{id}/key` and the `AttachRepositoryDeployKeyRequest` import/usage; in `ProjectController.kt`, remove the legacy GithubLink deploy-key endpoint(s).
- [ ] T024 [US1] In `services/agents-api/.../domain/port/AgentGatewayClient.kt`, remove `verifyAccess(...)`; remove its implementation in `infrastructure/integration/HttpAgentGatewayClient.kt`.
- [ ] T025 [US1] In `application/VerifyRepositoryAccess.kt`, drop the gateway read/write probe; keep only the `BranchProtectionClient` check. In `RepositoryVerificationService.kt`, re-check refreshes **branch protection only** (install-status lives behind the live `GET /{id}/installation-status`, M2).
- [ ] T026 [US1] In `infrastructure/web/dto/RepositoryDtos.kt`, drop `AttachRepositoryDeployKeyRequest`, the `verify.read`/`verify.write` fields on `RepositoryResponse`, and `deployKeyFingerprint`/`deployKeyAddedAt`/`vaultKeyPath`/`isKeyAttached`.
- [ ] T027 [P] [US1] Update/remove tests referencing the attach commands, `verifyAccess`, and the removed DTO fields.
- [ ] T028 [US1] Regenerate contract: `exportOpenApiSpec`; commit `openapi.json`.

### UI

- [ ] T029 [US1] Delete `services/agents-ui/src/features/repositories/components/AttachKeyWizard.vue` and `services/agents-ui/src/features/projects/components/AttachKeyWizard.vue`.
- [ ] T030 [US1] Remove `attachDeployKey()` from `repositoriesService.ts` and `attachKey()` from `stores/repositories.ts`; remove the "Deploy key" section and "Attach/Replace key" buttons from `views/RepositoryView.vue`.
- [ ] T031 [US1] Update `AccessStatusBadge.vue` to render the unified surface: App install-status + branch protection only (no read/write rows).
- [ ] T032 [US1] Regenerate UI types from `openapi.json`; fix any references to removed fields.
- [ ] T033 [P] [US1] Update UI tests (`repositories.store.test.ts`, `RepositoryView.test.ts`, etc.) to drop deploy-key paths.
- [ ] T034 [US1] Verify: agents-api tests + `pnpm --filter agents-ui typecheck && lint && test`; run the PR3 smoke from quickstart.

---

## Phase 5: PR4 — Drop storage + cleanup (US3)

**Goal**: Schema and stored secrets retired; docs reflect App-only setup.

**Independent Test**: Migration on a copy of prod data drops the columns; existing repos/sessions still work; Vault secrets best-effort deleted; docs updated.

- [ ] T035 [US3] Add `services/agents-api/src/main/resources/db/migration/V17__drop_deploy_keys.sql`: drop `vault_key_path`, `deploy_key_fingerprint`, `deploy_key_added_at`, `verify_read`, `verify_write` on `repositories`; drop `vault_key_path`, `deploy_key_fingerprint`, `deploy_key_added_at` on `github_links` (keep `verify_default_branch_protected`, `verify_checked_at`, `verify_messages`).
- [ ] T036 [US3] In `domain/model/Repository.kt` and `domain/model/GithubLink.kt`, remove the dropped fields and `isKeyAttached`; reshape `AccessVerification` to branch-protection-only.
- [ ] T037 [US3] In `infrastructure/persistence/JooqRepositoryRepository.kt` (and the GithubLink repository), stop reading/writing dropped columns; regenerate jOOQ classes.
- [ ] T038 [US3] In `application/command/CreateRepositoryCommandHandler.kt`, stop pre-allocating the Vault key path.
- [ ] T039 [US3] Delete `infrastructure/integration/VaultDeployKeyStore.kt` and `domain/port/DeployKeyStore.kt`; remove the `deployKeysProvider` injection points.
- [ ] T040 [US3] Implement best-effort Vault secret deletion (FR-009) for `secret/data/agents/repositories/<id>` and legacy `secret/data/agents/projects/<projectId>/repos/<linkId>` — a one-time startup/admin routine OR a documented manual command; log failures, never block boot/migration. **(M1: use the lower-level `VaultKeyValueWriter`/KV client, NOT `VaultDeployKeyStore`, so this is independent of T039's deletion of that store.)**
- [ ] T041 [P] [US3] Update `docs/REPO_SETUP.md` for App-only setup; delete/replace `services/agents-api/src/main/resources/templates/deploy-key-setup.md` with a GitHub App install guide.
- [ ] T042 [P] [US3] Update tests that constructed `Repository`/`GithubLink` with key fields or `VaultDeployKeyStore`.
- [ ] T043 [US3] Regenerate contract (`exportOpenApiSpec`) + UI types if the response shape changed; commit `openapi.json`.
- [ ] T044 [US3] Verify: full `./gradlew :services:agents-api:test --no-daemon` + `pnpm --filter agents-ui typecheck && lint && test`; run the PR4 migration smoke from quickstart.

---

## Phase 6: Validation (all stories)

- [ ] T045 Walk the full `quickstart.md` acceptance walkthrough (US1/US2/US3) against a deployed build; confirm SC-001..SC-006.
- [ ] T046 Confirm SSH-URL and legacy project-linked repos still run sessions (SC-006).
- [ ] T047 Capture a KB decision: deploy keys retired in favor of App-only repo access (slug `jorisjonkers-dev-agents`), no secrets in the note.

---

## Dependencies & parallelism

- **PR order**: PR1 (T003–T009) → PR2 (T010–T021) → PR3 (T022–T034) → PR4 (T035–T044) → Validation. Each PR is independently revertable.
- **Within PR2**: T010→T011→T012→T014 (backend chain), then UI T015–T021 after T014 + type regen. T013/T016/T020 are `[P]` (test files, distinct from impl files).
- **Within PR3**: backend T022–T028 before UI T029–T034 (contract/type regen at T028→T032). T027/T033 are `[P]`.
- **Within PR4**: T035→T036→T037 (schema→model→persistence) sequential; T041/T042 are `[P]`.
- **Contract gate**: never start UI tasks in a slice until that slice's `exportOpenApiSpec` + UI type regen have run (T014/T017, T028/T032, T043).

### Parallel example (PR2 tests)

```
# After backend impl lands, run these test-authoring tasks together:
T013 [P] backend status service/controller tests
T016 [P] githubAppLinks/GitHubAppReference tests
T020 [P] UI status/re-check/link tests
```
