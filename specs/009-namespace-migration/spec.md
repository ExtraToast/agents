# Feature Specification: JVM namespace migration to ExtraToast agents

**Feature Branch**: `009-namespace-migration`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Re-namespace the JVM code from the legacy monorepo package to an
agents-owned ExtraToast namespace, updating packages, coordinates, generated-code
configuration, Spring scans, and fully-qualified references with no behavior
change.

## Overview

The standalone `agents` repo still carries JVM package roots from the legacy
monorepo extraction:

- `services/agents-api`: `com.jorisjonkers.personalstack.agents.*`
- `services/agent-gateway`: `com.jorisjonkers.personalstack.agentgateway.*`

That extraction intentionally kept the inherited group and root package to bound
scope; only the final product segment moved from the old naming to `agents`.
This feature completes the ownership move by renaming the in-repo JVM namespace
and publication identity to the canonical ExtraToast agents namespace:
`dev.extratoast.agents`.

The chosen package layout is:

- `agents-api`: `dev.extratoast.agents.api.*`
- `agent-gateway`: `dev.extratoast.agents.gateway.*`
- generated JOOQ code: `dev.extratoast.agents.api.jooq.*`

This is a low-urgency, high-churn cleanup. It should land as one focused,
deterministic mechanical PR after the active feature work in specs 002 and 003
has settled enough to avoid repeated merge conflicts. Runtime behavior,
database shape, API contracts, service names, image names, and user-visible
labels are not intentionally changed by this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - JVM code has an owned namespace (Priority: P1)

A maintainer inspecting or editing the JVM services sees package declarations,
imports, generated JOOQ references, and Spring scan roots under
`dev.extratoast.agents`, not under the legacy monorepo root.

**Why this priority**: This is the purpose of the feature. The repo should no
longer present its owned service code as part of the previous monorepo package
hierarchy.

**Independent Test**: Run targeted searches for the old owned roots and inspect
the JVM source directories. No package declarations, imports, generated-package
configuration, Spring scan roots, or fully-qualified references for owned
`agents-api`/`agent-gateway` code remain under
`com.jorisjonkers.personalstack.agents` or
`com.jorisjonkers.personalstack.agentgateway`.

**Acceptance Scenarios**:

1. **Given** the migrated repo, **When** `services/agents-api` source and tests
   are inspected, **Then** package declarations and owned imports use
   `dev.extratoast.agents.api.*`.
2. **Given** the migrated repo, **When** `services/agent-gateway` source and
   tests are inspected, **Then** package declarations and owned imports use
   `dev.extratoast.agents.gateway.*`.
3. **Given** generated persistence code is configured, **When** JOOQ codegen
   runs for `agents-api`, **Then** generated types are emitted under
   `dev.extratoast.agents.api.jooq.*` and application imports compile against
   that package.

---

### User Story 2 - The mechanical migration stays behavior-neutral (Priority: P1)

The same services build, test, start, expose the same API contract, and keep the
same runtime behavior after the namespace move.

**Why this priority**: A namespace migration is high churn but should not alter
business behavior, persistence semantics, cluster integration, or UI contracts.

**Independent Test**: Run the JVM CI commands used by the repository workflow,
including checks, boot jars, and the OpenAPI export/contract gate. The resulting
CI aggregator is green and any OpenAPI diff is either empty or explained as
deterministic non-behavioral metadata.

**Acceptance Scenarios**:

1. **Given** the migrated packages, **When** JVM checks run, **Then** the
   repository's JVM check command passes for `agents-api` and `agent-gateway`.
2. **Given** the migrated packages, **When** boot jars are built, **Then**
   the repository's boot-jar command passes for `agents-api` and
   `agent-gateway`.
3. **Given** the migrated packages, **When** the OpenAPI export and UI contract
   checks run in CI, **Then** the API contract remains compatible with the
   pre-migration behavior.

---

### User Story 3 - The change is reviewable as one focused PR (Priority: P2)

A reviewer can evaluate the migration as a single deterministic codemod plus
verification, without unrelated feature changes or compatibility shims mixed in.

**Why this priority**: The change touches many files and can conflict with
active feature branches. Review stays tractable only if the PR is mechanical,
timed carefully, and behavior-neutral.

**Independent Test**: Review the PR diff. It contains package-path moves,
package declarations, imports, Gradle/JOOQ/Spring scan updates, generated-code
configuration, and search-result cleanup, with no unrelated functional edits.

**Acceptance Scenarios**:

1. **Given** specs 002 and 003 are still actively changing JVM files, **When**
   this migration is scheduled, **Then** it waits until those changes settle
   enough to avoid repeated conflict churn.
2. **Given** the migration PR, **When** the diff is reviewed, **Then** it is a
   single mechanical package/coordinate update with no intentional behavior
   changes.
3. **Given** repository CI, **When** the PR runs, **Then** `Pipeline Complete`
   is green before merge.

### Edge Cases

- `agents-api` currently uses `@SpringBootApplication(scanBasePackages =
  ["com.jorisjonkers.personalstack"])`; the scan boundary must move to owned
  service packages without accidentally dropping service beans or relying on the
  old monorepo root.
- `agent-gateway` relies on its application package root for component scanning;
  moving the root package must keep controllers, configuration, tmux, process,
  websocket, and git components discoverable.
- Kotlin files contain fully-qualified type references in addition to imports;
  codemod/search verification must catch both forms.
- Tests and integration tests live under matching old source-directory roots;
  package declarations, test package paths, fixtures, and any fully-qualified
  test doubles must move with main code.
- JOOQ generated sources and imports can become stale if old generated output or
  build caches remain; verification must include a clean codegen/compile path.
- Flyway migration files are historical database artifacts. Existing applied
  migrations, including historical filenames, must not be renamed in a way that
  changes Flyway history or checksums unless a Flyway-safe migration plan is
  explicitly recorded.
- Published shared libraries may still expose APIs under
  `com.jorisjonkers.personalstack.common.*`. Those dependency imports are not
  owned service package roots and may remain until the shared libraries publish
  a new namespace.
- Any external consumer that pins legacy JVM coordinates may need release-note
  handling even though no service behavior changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The canonical JVM namespace for owned code in this repo MUST be
  `dev.extratoast.agents`.
- **FR-002**: `services/agents-api` owned packages MUST move from
  `com.jorisjonkers.personalstack.agents.*` to
  `dev.extratoast.agents.api.*` across main, test, and integration-test code.
- **FR-003**: `services/agent-gateway` owned packages MUST move from
  `com.jorisjonkers.personalstack.agentgateway.*` to
  `dev.extratoast.agents.gateway.*` across main, test, and integration-test
  code.
- **FR-004**: JVM source directories MUST be moved to paths matching the new
  package declarations; stale old package-directory trees MUST be removed.
- **FR-005**: Imports, fully-qualified type references, reflection/configuration
  strings, test fixtures, and generated-code imports that refer to the old owned
  roots MUST be updated to the new namespace.
- **FR-006**: Gradle publication identity for the JVM services MUST move to the
  ExtraToast agents coordinate family, using group `dev.extratoast.agents` and
  preserving service artifact names (`agents-api`, `agent-gateway`) unless the
  planning step verifies an existing repository convention that requires a more
  specific artifact suffix.
- **FR-007**: `services/agents-api/build.gradle.kts` JOOQ configuration MUST set
  generated code to `dev.extratoast.agents.api.jooq` and all JOOQ imports MUST
  compile against the regenerated package.
- **FR-008**: Flyway migration locations MUST continue to resolve correctly for
  `agents-api`; the namespace migration MUST NOT introduce database schema,
  table, column, or data-value changes.
- **FR-009**: Spring Boot application scan configuration MUST be updated so
  `agents-api` and `agent-gateway` discover the same owned service components
  from the new package roots without scanning the legacy monorepo root.
- **FR-010**: Published shared-library imports under
  `com.jorisjonkers.personalstack.common.*` MAY remain if those are still the
  public APIs of dependencies consumed from `kotlin-spring-commons`; they MUST
  NOT be counted as failures of the owned-service namespace migration.
- **FR-011**: Product/runtime identifiers MUST remain unchanged unless they are
  JVM package or coordinate identifiers: service names, image names, HTTP paths,
  database schema, message/role enum values, config property names, Vault role
  names, and user-facing labels keep their existing behavior.
- **FR-012**: A deterministic search verification MUST show no remaining
  references to `com.jorisjonkers.personalstack.agents`,
  `com.jorisjonkers.personalstack.agentgateway`, or
  `com.jorisjonkers.personalstack.agents.jooq` except explicitly documented
  historical references that are not loaded as code/config.
- **FR-013**: The migration MUST land as one focused mechanical PR after specs
  002 and 003 are stable enough to avoid repeated conflict churn.
- **FR-014**: Repository CI MUST be green, including JVM checks, boot jars,
  OpenAPI/contract verification, Docker build coverage, and the single
  `Pipeline Complete` aggregator.

### Key Entities *(include if feature involves data)*

- **Canonical namespace**: `dev.extratoast.agents`, the owning JVM namespace for
  this repo's service code.
- **API package root**: `dev.extratoast.agents.api.*`, replacing the old
  `agents-api` owned root.
- **Gateway package root**: `dev.extratoast.agents.gateway.*`, replacing the old
  `agent-gateway` owned root.
- **JOOQ generated package**: `dev.extratoast.agents.api.jooq.*`, generated from
  the existing `agents-api` migrations.
- **JVM coordinates**: the Gradle publication identity for the JVM services,
  moved under group `dev.extratoast.agents`.
- **Allowed external dependency namespace**:
  `com.jorisjonkers.personalstack.common.*` imports from published shared
  libraries, if still required by current dependency APIs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Targeted searches find zero active code/config references to the
  old owned roots `com.jorisjonkers.personalstack.agents`,
  `com.jorisjonkers.personalstack.agentgateway`, and
  `com.jorisjonkers.personalstack.agents.jooq`.
- **SC-002**: `./gradlew :services:agents-api:check
  :services:agent-gateway:check --no-daemon` passes.
- **SC-003**: `./gradlew :services:agents-api:bootJar
  :services:agent-gateway:bootJar --no-daemon` passes.
- **SC-004**: The OpenAPI export and UI contract gate pass with no intentional
  user-visible contract change.
- **SC-005**: GitHub CI reports `Pipeline Complete` green for the migration PR.
- **SC-006**: No database migration, runtime configuration migration, endpoint
  rename, service rename, or persisted value change is required for existing
  environments.

## Assumptions

- Spec 001 has already established the standalone `agents` repo with
  `services/agents-api` and `services/agent-gateway` present.
- The namespace migration waits until the active 002/003 work has settled enough
  to keep the PR mechanical and conflict-light.
- Existing database schema/table/column names do not encode the old product
  package root, so Flyway history should stay semantically unchanged.
- Shared-library APIs consumed from `kotlin-spring-commons` may remain under
  their currently published package names until those libraries intentionally
  migrate in a separate change.

## Open Questions

- [NEEDS CLARIFICATION: whether any external consumer pins the current legacy
  JVM Maven coordinates outside this repository's CI/release flow.]
- [NEEDS CLARIFICATION: whether a separate shared-library namespace migration is
  planned for `kotlin-spring-commons`; this spec treats it as out of scope.]

## Non-Goals

- Changing service behavior, HTTP endpoints, websocket behavior, OpenAPI shapes,
  UI behavior, service names, image names, or deployment names.
- Renaming database schema objects, persisted enum values, message roles,
  Flyway-applied migration contents, Vault paths, or runtime config properties.
- Migrating published shared libraries or their public package names.
- Implementing session persistence/restart behavior from spec 002.
- Implementing the agents UI redesign from spec 003.
