# Feature Specification: Scaffold CI Workspace

**Feature Branch**: `016-scaffold-ci-workspace`
**Created**: 2026-06-16
**Status**: Draft
**Input**: Spec the project scaffold and CI baseline for the Capacitor accounts + agents app.

## Decision

Capacitorize `services/agents-ui` in place. The accepted native-target ADR in `specs/013-native-target-adr/spec.md` makes this the default reuse path, and `pnpm-workspace.yaml` already registers `services/agents-ui` as the only pnpm workspace member.

Do not create `services/accounts-agents-app` for this scaffold. That package is allowed only if a separate feature-extraction milestone lands before native scaffold implementation begins. If that later happens, the new package must be added to `pnpm-workspace.yaml` in the same scaffold PR and must prove the existing `@extratoast/agents-ui` checks still pass.

The scaffold owns the initial native shell, platform plugin registration slots, and CI job wiring. Later feature specs may fill package scripts or implementation behind the prewired slots, but they must not edit `.github/workflows/ci.yml`.

## User Scenarios & Testing

### User Story 1 - Native Shell Placement (Priority: P1)

A maintainer can add the Android and iOS Capacitor shell around the existing agents UI without creating a second app surface.

**Why this priority**: The ADR selected reuse of the current DOM/Vue app to preserve terminal, streaming, PrimeVue, and Tailwind parity.

**Independent Test**: After scaffold implementation, run the existing `@extratoast/agents-ui` lint, typecheck, test, and build commands from the pnpm workspace.

**Acceptance Scenarios**:

1. **Given** the current `pnpm-workspace.yaml` lists only `services/agents-ui`, **When** the in-place scaffold lands, **Then** no new workspace member is required and `services/agents-ui` remains the app package.
2. **Given** the extraction milestone has not landed, **When** scaffold work begins, **Then** `services/accounts-agents-app` is not created.
3. **Given** the native shell is generated, **When** Android and iOS projects are inspected, **Then** they come from `npx cap add android` and `npx cap add ios` for the selected app package.

---

### User Story 2 - CI Skeleton (Priority: P1)

A maintainer can see all app gates in CI before downstream specs fill the native and contract scripts.

**Why this priority**: Branch protection requires one `Pipeline Complete` gate, so new app gates must be prewired into that aggregator instead of added piecemeal by later specs.

**Independent Test**: Inspect `.github/workflows/ci.yml` after scaffold implementation and verify `pipeline-complete` needs every app job stub.

**Acceptance Scenarios**:

1. **Given** the repo uses a single terminal `Pipeline Complete` job, **When** the scaffold updates CI, **Then** `app-web-check`, `app-contract`, `app-android-smoke`, and `app-native-e2e` are named jobs and are included in `pipeline-complete.needs`.
2. **Given** the repo has no `pnpm-lock.yaml`, **When** app jobs install dependencies, **Then** they use `pnpm install --no-frozen-lockfile`.
3. **Given** later specs add scripts behind the app gates, **When** they implement those scripts, **Then** they do not edit `.github/workflows/ci.yml`.

---

### User Story 3 - Platform Abstractions (Priority: P2)

A feature implementer can use native capabilities through stable interfaces while web builds keep no-op fallbacks.

**Why this priority**: Capacitor plugins must not leak into feature code or break the existing web product surface.

**Independent Test**: Unit-test web fallback adapters without a native runtime and verify app bootstrap registers plugin slots before router mount.

**Acceptance Scenarios**:

1. **Given** the app runs on web, **When** platform services are resolved, **Then** no-op web fallbacks are used and no native plugin is required.
2. **Given** the app runs under Capacitor, **When** platform services are resolved, **Then** Capacitor-backed implementations are selected behind the same interfaces.
3. **Given** `services/agents-ui/src/main.ts` bootstraps the app, **When** the scaffold lands, **Then** it contains scaffold-owned plugin-registration slots that downstream platform features extend without reworking bootstrap order.

### Edge Cases

- If a `pnpm-lock.yaml` is introduced by a separate policy decision before implementation, this spec must be revisited before CI install flags change.
- If latest `ExtraToast/repo-template` CI conflicts with the current workflow shape, the scaffold PR must first reconcile the template baseline while preserving the single `Pipeline Complete` gate.
- If adding Capacitor dependencies causes duplicate Vue, TypeScript, Vite, or test tooling versions, the scaffold PR must pin or dedupe dependencies before merge.
- If native shell generation changes files outside the selected app package and native project directories, the scaffold PR must call out ownership explicitly before landing.

## Requirements

### Functional Requirements

- **FR-001**: The scaffold MUST implement the ADR default by Capacitorizing `services/agents-ui` in place.
- **FR-002**: The scaffold MUST NOT create `services/accounts-agents-app` unless a separate feature-extraction milestone has already landed.
- **FR-003**: If the deferred `services/accounts-agents-app` alternative becomes valid before scaffold implementation, the scaffold MUST register it in `pnpm-workspace.yaml` and MUST keep `@extratoast/agents-ui` checks green.
- **FR-004**: The scaffold MUST add Capacitor 7 dependencies for `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, and `@capacitor/ios` with deliberate exact pins using one Capacitor version across all four packages.
- **FR-005**: The scaffold MUST generate Android and iOS native project directories with `npx cap add android` and `npx cap add ios` from the selected app package.
- **FR-006**: The scaffold MUST add a platform-abstraction layer so feature code depends on interfaces with Capacitor-backed native implementations and web no-op fallbacks.
- **FR-007**: `services/agents-ui/src/main.ts` MUST include scaffold-owned plugin-registration slots before the router is mounted.
- **FR-008**: The scaffold MUST preserve the current lockfile policy: this repo has no `pnpm-lock.yaml`, and CI installs MUST use `pnpm install --no-frozen-lockfile`.
- **FR-009**: The scaffold MUST keep `pnpm --filter @extratoast/agents-ui lint`, `typecheck`, `test`, and `build` green after dependency and workspace changes.
- **FR-010**: `.github/workflows/ci.yml` MUST add named job stubs `app-web-check`, `app-contract`, `app-android-smoke`, and `app-native-e2e`.
- **FR-011**: `pipeline-complete.needs` MUST include every app job stub added by this scaffold.
- **FR-012**: `.github/workflows/ci.yml` MUST be treated as owned by this scaffold spec for app job wiring; later specs fill scripts behind prewired commands and must not edit the workflow.
- **FR-013**: The scaffold PR MUST pull or reconcile the latest `ExtraToast/repo-template` CI baseline before changing app job wiring.
- **FR-014**: The scaffold MUST preserve the repo's squash-only PR flow and single required `Pipeline Complete` check described in `CONTRIBUTING.md`.

### Key Entities

- **Selected app package**: `services/agents-ui`, the existing Vue app and current pnpm workspace member.
- **Deferred composed app**: `services/accounts-agents-app`, allowed only after feature extraction lands as its own milestone.
- **Platform abstraction layer**: Interfaces plus native Capacitor adapters and web no-op adapters.
- **CI app job stubs**: `app-web-check`, `app-contract`, `app-android-smoke`, and `app-native-e2e`, all aggregated by `pipeline-complete`.
- **Plugin-registration slots**: Scaffold-owned bootstrap hooks in `services/agents-ui/src/main.ts`.

## File Ownership Rules

- `pnpm-workspace.yaml`: scaffold may edit only if the valid implementation path requires a new workspace member; in-place Capacitorization should leave the current `services/agents-ui` member intact.
- `services/agents-ui/package.json`: scaffold owns Capacitor dependency additions and app scripts needed by the CI stubs; dependency versions must be exact-pinned or deliberately deduped.
- `services/agents-ui/src/main.ts`: scaffold owns plugin-registration slots and bootstrap ordering for platform services.
- `android/` and `ios/` native project directories under the selected app package: scaffold owns initial generation from `npx cap add`.
- `.github/workflows/ci.yml`: scaffold owns all app job stub additions and `pipeline-complete.needs` wiring. Later specs must not edit this workflow file.

## Success Criteria

- **SC-001**: The scaffold lands without creating a second app package when no extraction milestone has landed.
- **SC-002**: Capacitor 7 packages and generated Android/iOS shell files are present for the selected app package.
- **SC-003**: Web fallback platform adapters allow the app to build and test without a native runtime.
- **SC-004**: CI contains the four named app job stubs and `Pipeline Complete` aggregates them.
- **SC-005**: Dependency installation follows the no-lockfile policy with `pnpm install --no-frozen-lockfile`.
- **SC-006**: `@extratoast/agents-ui` lint, typecheck, test, and build remain green after scaffold implementation.
