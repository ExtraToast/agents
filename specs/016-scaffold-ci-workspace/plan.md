# Implementation Plan: Scaffold CI Workspace

**Branch**: `016-scaffold-ci-workspace` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-scaffold-ci-workspace/spec.md`

## Summary

Add the native scaffold and CI baseline around the existing `services/agents-ui` package. The implementation keeps the current pnpm workspace shape, adds Capacitor 7 and generated Android/iOS shells in place, introduces platform service interfaces with web fallbacks, prewires app CI job stubs into `Pipeline Complete`, and keeps the existing agents UI checks green.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x, Node 22, pnpm 9.15.4
**Primary Dependencies**: Capacitor 7, existing Vue/Vite/Vitest/Playwright stack in `services/agents-ui`
**Storage**: N/A for scaffold; later native auth specs own secure token storage
**Testing**: `pnpm --filter @extratoast/agents-ui lint`, `typecheck`, `test`, `build`; CI workflow lint through existing `workflow-lint`
**Target Platform**: Web, Android, and iOS from one Capacitorized Vue app
**Project Type**: pnpm workspace member plus generated native shell projects
**Performance Goals**: No regression to existing agents-ui build/test time beyond native smoke job overhead
**Constraints**: No `pnpm-lock.yaml`; CI install uses `pnpm install --no-frozen-lockfile`; `.github/workflows/ci.yml` app job wiring is owned only by this scaffold; squash-only PR flow and one `Pipeline Complete` gate remain intact
**Scale/Scope**: One app package, four CI job stubs, one platform bootstrap layer, generated Android/iOS shell directories

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Existing agents-ui behavior is preserved by scaffolding in place
- [x] Rendered artifacts are generated only by the owning Capacitor command
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification commands are identified for package, workspace, and CI changes

## Project Structure

### Documentation

```text
specs/016-scaffold-ci-workspace/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Existing Files Read For This Plan

```text
pnpm-workspace.yaml
package.json
services/agents-ui/package.json
services/agents-ui/src/main.ts
.github/workflows/ci.yml
CONTRIBUTING.md
VERSIONING.md
specs/013-native-target-adr/spec.md
```

### Implementation Ownership

```text
pnpm-workspace.yaml
services/agents-ui/package.json
services/agents-ui/src/main.ts
.github/workflows/ci.yml
```

The implementation will also create native project directories under the selected app package by running Capacitor add commands. Platform abstraction files are new scaffold-owned source files under the selected app package; later specs add implementations behind the interfaces rather than editing bootstrap ownership.

**Structure Decision**: Keep `services/agents-ui` as the selected package. `pnpm-workspace.yaml` currently lists only `services/agents-ui`; no workspace registration change is needed unless the deferred extraction milestone lands first.

## Phase 0: Baseline Reconciliation

1. Confirm no `pnpm-lock.yaml` exists at the repository root.
2. Confirm `pnpm-workspace.yaml` lists `services/agents-ui`.
3. Pull or reconcile the latest `ExtraToast/repo-template` CI baseline before app job edits.
4. Preserve the current single terminal `Pipeline Complete` gate and squash-only conventions from `CONTRIBUTING.md`.

**Gate**: Do not add app job stubs until the workflow shape still matches the repo-template single-aggregator pattern.

## Phase 1: Workspace And Dependency Scaffold

1. Keep scaffold placement in `services/agents-ui`.
2. Add exact-pinned Capacitor 7 dependencies for:
   - `@capacitor/core`
   - `@capacitor/cli`
   - `@capacitor/android`
   - `@capacitor/ios`
3. Use one Capacitor version across all four packages.
4. Dedupe with existing root and agents-ui TypeScript/Vite/Vitest/Vue dependencies instead of adding competing versions.
5. Keep the no-lockfile policy; do not add `pnpm-lock.yaml`.

**Gate**: `pnpm install --no-frozen-lockfile` resolves without introducing duplicate app-critical packages that would break lint, typecheck, test, or build.

## Phase 2: Capacitor Native Shell

1. Initialize Capacitor config for the selected app package with an app id and app name owned by this scaffold.
2. Run `npx cap add android` from the selected app package.
3. Run `npx cap add ios` from the selected app package.
4. Commit only generated native shell files that are required to build Android/iOS from source.
5. Do not change feature routes, auth behavior, runtime origins, or native release signing in this scaffold.

**Gate**: Native shell generation does not move or fork existing agents-ui feature code.

## Phase 3: Platform Abstraction And Bootstrap Slots

1. Add platform service interfaces for native plugin-backed capabilities.
2. Add web no-op fallback implementations so regular web build/test does not require Capacitor runtime APIs.
3. Add Capacitor-backed implementations only behind the interfaces.
4. Add plugin-registration slots in `services/agents-ui/src/main.ts` before router mount and after auth/session initialization decisions required by the slot.
5. Keep feature code importing abstractions, not direct Capacitor plugins.

**Gate**: Web tests can instantiate fallbacks without mocking Android or iOS.

## Phase 4: CI Skeleton

1. Edit `.github/workflows/ci.yml` in this scaffold only.
2. Add named job stubs:
   - `app-web-check`
   - `app-contract`
   - `app-android-smoke`
   - `app-native-e2e`
3. Wire all four jobs into `pipeline-complete.needs`.
4. Use `pnpm install --no-frozen-lockfile` in app jobs while the repo has no lockfile.
5. Keep the existing `ui-check` job green; do not remove current JVM, UI, OpenAPI, Docker, or workflow-lint gates.
6. Later specs may update package scripts consumed by the stubs, but must not edit the workflow.

**Gate**: `Pipeline Complete` remains the only required check name and fails if any app job stub fails.

## Phase 5: Verification

Run the following after implementation:

```bash
test ! -f pnpm-lock.yaml
pnpm install --no-frozen-lockfile
pnpm --filter @extratoast/agents-ui lint
pnpm --filter @extratoast/agents-ui typecheck
pnpm --filter @extratoast/agents-ui test
pnpm --filter @extratoast/agents-ui build
grep -q 'app-web-check' .github/workflows/ci.yml
grep -q 'app-contract' .github/workflows/ci.yml
grep -q 'app-android-smoke' .github/workflows/ci.yml
grep -q 'app-native-e2e' .github/workflows/ci.yml
grep -q 'pipeline-complete' .github/workflows/ci.yml
```

Native smoke and native e2e script bodies may be placeholders in the first scaffold PR, but their CI job names and aggregator wiring must exist.

## Risks And Mitigations

- **Dependency drift**: Exact-pin new Capacitor packages and run the full agents-ui check sequence before merge.
- **Workflow churn by later specs**: Prewire all app job names now and make later specs update package scripts only.
- **Second app surface**: Block `services/accounts-agents-app` unless the extraction milestone lands first.
- **No-lockfile installs**: Keep `pnpm install --no-frozen-lockfile` explicit in every Node CI job until repository policy changes.
- **Native plugin leakage**: Route Capacitor plugins through interfaces and web fallbacks so feature code remains testable on web.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Evidence complete for this spec
- [ ] Phase 1: Workspace and dependency scaffold
- [ ] Phase 2: Capacitor native shell
- [ ] Phase 3: Platform abstraction and bootstrap slots
- [ ] Phase 4: CI skeleton
- [ ] Phase 5: Verification

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved

## Documentation-Only Verification

```bash
test -f specs/016-scaffold-ci-workspace/spec.md \
  && test -f specs/016-scaffold-ci-workspace/plan.md \
  && test -f specs/016-scaffold-ci-workspace/tasks.md \
  && grep -qi pnpm-workspace specs/016-scaffold-ci-workspace/spec.md \
  && grep -qi 'pipeline-complete\|Pipeline Complete' specs/016-scaffold-ci-workspace/spec.md
```
