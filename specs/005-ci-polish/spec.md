# Feature Specification: CI polish and residual identifier cleanup

**Feature Branch**: `005-ci-polish`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Close the remaining verification SHOULD items so the agents repo
matches organization conventions and drops personal-stack residue.

## Overview

The extracted `agents` repo is functional, but a few low-risk polish items still
keep it from matching the expected repository conventions. CI still carries
bespoke inline jobs in `.github/workflows/ci.yml`, UI dependency installs are
allowed to resolve without a committed lockfile, and a small set of local names
still reference the old source repo in `services/agents-ui`.

This feature tightens those edges without changing product behavior. CI should
reuse shared `ExtraToast/github-workflows` workflows or composite actions where
an equivalent exists while preserving the existing `Pipeline Complete`
aggregator. UI package installs should be reproducible through a committed
`pnpm-lock.yaml` and frozen installs in CI and Docker builds. The residual UI
identifiers (`PersonalStackRole`, `personalStackThemeOptions`, and `ps_theme`)
should be renamed to agents-neutral names, and the OpenAPI contract
documentation plus stale comments should describe the repo as it exists now.
Docker build stages should use a Gradle base image aligned with the checked-in
wrapper version.

Builds on spec 001 and intentionally stays small: these are convention,
reproducibility, and naming/documentation corrections, verified by CI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CI follows shared workflow conventions (Priority: P1)

A maintainer reviewing the repository sees the standard shared CI shape:
equivalent `ExtraToast/github-workflows` reusable workflows or composite actions
are used instead of bespoke inline job bodies, and `Pipeline Complete` remains
the single aggregate gate for the PR.

**Why this priority**: Repository CI is the primary organization-convention
surface, and this cleanup must not weaken the existing required check model.

**Independent Test**: Inspect `.github/workflows/ci.yml` and run CI for a PR.
Jobs with shared equivalents delegate to `ExtraToast/github-workflows`, all
current validation responsibilities remain covered, and the `Pipeline Complete`
job passes only when its dependencies pass.

**Acceptance Scenarios**:

1. **Given** an inline CI job has an equivalent shared reusable workflow or
   composite action, **When** the workflow is updated, **Then** the job uses the
   shared implementation while preserving its validation responsibility.
2. **Given** an inline CI job has no equivalent shared implementation, **When**
   the workflow is reviewed, **Then** the job remains covered and the missing
   equivalent is explicitly noted for planning rather than silently removed.
3. **Given** CI runs for a PR, **When** any gating validation fails, **Then**
   `Pipeline Complete` fails; when all required validations pass, **Then**
   `Pipeline Complete` passes.

---

### User Story 2 - UI installs are reproducible (Priority: P1)

A maintainer can run CI or build the UI container from a clean checkout and get
the exact dependency graph captured by the repository lockfile.

**Why this priority**: The current unfrozen installs can hide dependency drift
and make CI or Docker results depend on package resolution at install time.

**Independent Test**: From a clean checkout, run the UI install path used by CI
and the `services/agents-ui/Dockerfile`; both use `pnpm install
--frozen-lockfile` and succeed because `pnpm-lock.yaml` is committed.

**Acceptance Scenarios**:

1. **Given** the repo contains `package.json`, `pnpm-workspace.yaml`, and
   `services/agents-ui/package.json`, **When** dependencies are installed in CI,
   **Then** the install uses the committed `pnpm-lock.yaml` and
   `--frozen-lockfile`.
2. **Given** the UI Docker image is built, **When** dependencies are installed in
   `services/agents-ui/Dockerfile`, **Then** the Docker build also uses the
   committed lockfile with `--frozen-lockfile`.
3. **Given** a package manifest changes without a matching lockfile update,
   **When** CI or the Docker build runs, **Then** the install fails instead of
   resolving a new graph implicitly.

---

### User Story 3 - Residual source-repo naming is removed from local surfaces (Priority: P2)

An operator or maintainer reading the UI code, contract documentation, and
comments sees agents-neutral names rather than leftover personal-stack names
that no longer describe this repository.

**Why this priority**: The extraction is confusing if local code and docs still
refer to the previous repo for active identifiers, workflow files, or removed
services.

**Independent Test**: Search the repository for the known residual identifiers
and stale workflow reference. The exact UI identifiers are gone, the app shell
still receives theme options, and `services/agents-api/CONTRACT.md` references
`.github/workflows/ci.yml` and the `openapi-contract` job.

**Acceptance Scenarios**:

1. **Given** `services/agents-ui/src/lib/vueWebCommons.ts` and its consumers,
   **When** the cleanup is complete, **Then** `PersonalStackRole`,
   `personalStackThemeOptions`, and the `ps_theme` storage key are replaced with
   agents-neutral names and all imports/call sites compile.
2. **Given** `services/agents-api/CONTRACT.md`, **When** a maintainer reads the
   CI failure guidance, **Then** it points at `.github/workflows/ci.yml` and the
   `openapi-contract` job rather than a removed workflow file.
3. **Given** comments or docs point at removed personal-stack paths or services,
   **When** the cleanup is complete, **Then** those references are updated or
   removed without changing runtime behavior.

---

### User Story 4 - Docker build stages track the Gradle wrapper (Priority: P3)

A maintainer comparing Docker build stages with the checked-in Gradle wrapper
sees one Gradle version, so local and containerized builds use the same major
tooling baseline.

**Why this priority**: The mismatch is low risk, but leaving it in place creates
avoidable drift and makes future build failures harder to reason about.

**Independent Test**: Inspect every Dockerfile Gradle build stage and
`gradle/wrapper/gradle-wrapper.properties`; the Docker base image versions match
the wrapper distribution version, and Docker build validation still passes.

**Acceptance Scenarios**:

1. **Given** the wrapper distribution is Gradle 9.5.1, **When** Dockerfiles with
   Gradle build stages are inspected, **Then** their Gradle base images use the
   same Gradle version.
2. **Given** CI builds the service images, **When** the Docker build matrix runs,
   **Then** the Gradle image alignment introduces no build regression.

### Edge Cases

- A current inline CI job may have no exact shared workflow/action equivalent;
  it must remain covered rather than being dropped. [NEEDS CLARIFICATION: exact
  `ExtraToast/github-workflows` reusable workflow and composite action mapping is
  not enumerated in the source outline.]
- `Pipeline Complete` must continue to depend on every gating job after the CI
  workflow is reshaped, including the OpenAPI contract and Docker build coverage.
- The committed `pnpm-lock.yaml` must represent the root workspace and
  `services/agents-ui`; frozen installs must still authenticate to the GitHub
  Packages registry for `@extratoast` packages.
- Renaming the UI theme storage key may reset or migrate an existing browser's
  stored theme preference. [NEEDS CLARIFICATION: whether the old `ps_theme`
  value should be migrated, intentionally ignored, or read only once.]
- Historical data examples or migration comments may mention repository names as
  literal sample data; only stale active references to removed paths/services and
  the specified local identifiers are in scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `.github/workflows/ci.yml` MUST reuse
  `ExtraToast/github-workflows` reusable workflows or composite actions for
  current CI responsibilities where an equivalent shared implementation exists.
- **FR-002**: CI MUST preserve coverage for workflow linting, JVM check/build for
  `services:agents-api` and `services:agent-gateway`, UI lint/typecheck/test/build,
  OpenAPI contract drift checks, and the service Docker build matrix.
- **FR-003**: CI MUST keep the `Pipeline Complete` aggregator as the required
  aggregate status and include every gating validation in its dependency list.
- **FR-004**: The repo MUST commit `pnpm-lock.yaml` for the current pnpm
  workspace and package manifests.
- **FR-005**: CI UI installs and the `services/agents-ui/Dockerfile` dependency
  install MUST use `pnpm install --frozen-lockfile` rather than
  `--no-frozen-lockfile`.
- **FR-006**: `services/agents-ui` MUST rename `PersonalStackRole`,
  `personalStackThemeOptions`, and the `ps_theme` theme storage key to
  agents-neutral names, updating all imports and call sites.
- **FR-007**: Existing browser theme preference behavior MUST be handled by
  [NEEDS CLARIFICATION: migrate the old key, intentionally reset to the default,
  or temporarily read the old key during one release].
- **FR-008**: `services/agents-api/CONTRACT.md` MUST reference the real
  `.github/workflows/ci.yml` `openapi-contract` job for OpenAPI contract
  validation and failure guidance.
- **FR-009**: Stale comments or docs that point at removed personal-stack paths
  or services MUST be updated or removed; intentional historical data examples
  are allowed to remain.
- **FR-010**: Dockerfiles with Gradle build stages MUST use a Gradle base image
  version aligned with `gradle/wrapper/gradle-wrapper.properties`.
- **FR-011**: The completed cleanup MUST be validated by the smallest meaningful
  CI-equivalent checks for the touched areas, including frozen UI install,
  type/lint/test coverage where affected, OpenAPI contract coverage, and Docker
  build coverage.

### Key Entities *(include if feature involves data)*

- **CI workflow**: `.github/workflows/ci.yml`, including shared workflow/action
  usage, the existing validation jobs, and the `Pipeline Complete` aggregator.
- **UI dependency lockfile**: `pnpm-lock.yaml`, tied to the root pnpm workspace
  and `services/agents-ui/package.json`.
- **Agents UI commons wrapper**: `services/agents-ui/src/lib/vueWebCommons.ts`
  and app-shell consumers that expose auth and theme helpers.
- **OpenAPI contract documentation**: `services/agents-api/CONTRACT.md`, the
  maintainer guide for regenerating and checking the API/UI contract.
- **Gradle Docker build stages**: Gradle base images in service Dockerfiles that
  should match the checked-in wrapper version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A PR run completes with `Pipeline Complete` green, and every
  gating validation still participates in that aggregate status.
- **SC-002**: CI and `services/agents-ui/Dockerfile` use
  `pnpm install --frozen-lockfile`, `pnpm-lock.yaml` is committed, and a manifest
  change without a lockfile update fails install validation.
- **SC-003**: Repository search finds zero remaining occurrences of
  `PersonalStackRole`, `personalStackThemeOptions`, or `ps_theme`.
- **SC-004**: `services/agents-api/CONTRACT.md` references `.github/workflows/ci.yml`
  and `openapi-contract`, with no remaining reference to
  `.github/workflows/contract-validate.yml`.
- **SC-005**: Dockerfiles with Gradle build stages use the same Gradle version as
  the wrapper distribution, currently 9.5.1.
- **SC-006**: No stale active comments or docs point at removed personal-stack
  paths or services introduced by the repo extraction.

## Assumptions

- Spec 001 has already established the standalone `agents` repository and the
  `Pipeline Complete` required-check model.
- The current pnpm version remains `9.15.4`, matching `package.json` and the UI
  Dockerfile.
- Some `ExtraToast/github-workflows` equivalents exist for the current CI
  responsibilities, but exact reusable workflow/action names are discovered
  during planning.
- The cleanup is low risk and should not require runtime data migrations beyond
  the clarified theme storage-key behavior.

## Non-Goals

- Changing product behavior, auth behavior, API routes, session behavior, or the
  agents UI redesign.
- Renaming JVM package namespaces or database schemas beyond stale comments/docs
  explicitly tied to removed paths or services.
- Removing `Pipeline Complete` or changing the repository's required-check
  policy.
- Replacing pnpm, changing package versions for unrelated reasons, or performing
  broad dependency upgrades.
