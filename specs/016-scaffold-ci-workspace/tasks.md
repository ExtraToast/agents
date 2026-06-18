# Tasks: Scaffold CI Workspace

**Input**: Scaffold specification from `/specs/016-scaffold-ci-workspace/spec.md`
**Prerequisites**: `specs/013-native-target-adr/spec.md`, current `pnpm-workspace.yaml`, current `.github/workflows/ci.yml`

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel because it touches different files or only reads source context
- Tasks describe the implementation work for this scaffold. Later specs fill prewired scripts and feature behavior without editing `.github/workflows/ci.yml`.

## Phase 1: Baseline Verification

- [ ] T001 Verify the latest `ExtraToast/repo-template` CI baseline and reconcile any required workflow shape before app job edits
- [ ] T002 Verify `pnpm-workspace.yaml` lists `services/agents-ui` and that no feature-extraction milestone has landed that would require `services/accounts-agents-app`
- [ ] T003 Verify the repo still has no root `pnpm-lock.yaml`
- [ ] T004 Verify `CONTRIBUTING.md` still documents squash-only PRs and one required `Pipeline Complete` check
- [ ] T005 Verify existing `services/agents-ui/package.json` scripts for lint, typecheck, test, build, and contract checks

## Phase 2: Workspace And Capacitor Dependencies

- [ ] T006 Keep `services/agents-ui` as the selected app package and avoid creating `services/accounts-agents-app`
- [ ] T007 Add exact-pinned Capacitor 7 dependencies for `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, and `@capacitor/ios` in `services/agents-ui/package.json`
- [ ] T008 Dedupe new dependency choices against existing root and `services/agents-ui` TypeScript, Vue, Vite, Vitest, and Playwright versions
- [ ] T009 Add scaffold-owned package scripts needed by the app CI job stubs without removing current agents-ui scripts
- [ ] T010 Run `pnpm install --no-frozen-lockfile` and confirm no `pnpm-lock.yaml` is added

## Phase 3: Native Shell Generation

- [ ] T011 Initialize Capacitor config for the selected app package
- [ ] T012 Run `npx cap add android` from the selected app package and keep the generated Android shell under that package
- [ ] T013 Run `npx cap add ios` from the selected app package and keep the generated iOS shell under that package
- [ ] T014 Review generated native shell files for accidental secrets, machine-local paths, or unrelated formatting churn

## Phase 4: Platform Abstraction And Bootstrap

- [ ] T015 Add platform service interfaces for native plugin-backed capabilities in the selected app package
- [ ] T016 Add web no-op fallback implementations that work in normal Vitest and Vite web builds
- [ ] T017 Add Capacitor-backed implementations behind the same interfaces
- [ ] T018 Update `services/agents-ui/src/main.ts` with scaffold-owned plugin-registration slots before router mount
- [ ] T019 Add focused tests for web fallback resolution and plugin registration order

## Phase 5: CI Skeleton

- [ ] T020 Update `.github/workflows/ci.yml` with an `app-web-check` job stub
- [ ] T021 Update `.github/workflows/ci.yml` with an `app-contract` job stub
- [ ] T022 Update `.github/workflows/ci.yml` with an `app-android-smoke` job stub
- [ ] T023 Update `.github/workflows/ci.yml` with an `app-native-e2e` job stub
- [ ] T024 Wire `app-web-check`, `app-contract`, `app-android-smoke`, and `app-native-e2e` into `pipeline-complete.needs`
- [ ] T025 Ensure every Node install in new app jobs uses `pnpm install --no-frozen-lockfile`
- [ ] T026 Keep existing `workflow-lint`, `jvm-check`, `ui-check`, `openapi-contract`, and `docker-build` gates wired into `pipeline-complete.needs`

## Phase 6: Acceptance Verification

- [ ] T027 Run `pnpm --filter @extratoast/agents-ui lint`
- [ ] T028 Run `pnpm --filter @extratoast/agents-ui typecheck`
- [ ] T029 Run `pnpm --filter @extratoast/agents-ui test`
- [ ] T030 Run `pnpm --filter @extratoast/agents-ui build`
- [ ] T031 Verify `.github/workflows/ci.yml` contains the four named app jobs and that `pipeline-complete.needs` includes them
- [ ] T032 Run workflow lint or the existing CI workflow lint job locally where available

## Dependencies

- T001 precedes T020 through T026 because app job edits must start from the repo-template CI baseline.
- T002 and T006 precede T007 through T014 because package placement decides where dependencies and native shells are generated.
- T007 through T010 precede T011 through T013 because Capacitor commands require installed Capacitor packages.
- T015 through T018 precede downstream native/auth/design specs that consume platform services.
- T020 through T026 must land in this scaffold; later specs must not edit `.github/workflows/ci.yml`.
- T027 through T032 run after scaffold changes and before merge.

## Downstream Handoff

- Native networking and auth specs add behavior behind the platform abstractions and package scripts created here.
- Contract specs fill the `app-contract` script or command surface, but keep the existing workflow job name.
- Release specs decide signing, stores, release gating, and whether native e2e is required, scheduled, or manual beyond this stub.
- Design specs may install UI/platform plugins through the registration slots but do not reorder `services/agents-ui/src/main.ts` bootstrap.

## Parallel Example

```text
T015 [P] Add platform service interfaces
T016 [P] Add web no-op fallback implementations
T020 [P] Update CI with app-web-check job stub
T021 [P] Update CI with app-contract job stub
```

```text
T027 [P] Run agents-ui lint
T028 [P] Run agents-ui typecheck
T029 [P] Run agents-ui test
T030 [P] Run agents-ui build
```
