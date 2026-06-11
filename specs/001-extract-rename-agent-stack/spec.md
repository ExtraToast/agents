# Feature Specification: Extract & rename the agent stack into ExtraToast/agents

**Feature Branch**: `001-extract-rename-agent-stack`
**Created**: 2026-06-11
**Status**: Draft
**Input**: Move the agent stack out of `personal-stack` into a standalone
`ExtraToast/agents` repo, rename the "assistant" naming to "agents", scaffold the
repo from the latest `repo-template`, and reuse the shared actions / versioning /
libraries — leaving `personal-stack` consuming the released artifacts.

## Overview

The agent system (the API, the browser UI, the in-pod gateway, and the runner
image) currently lives inside the `personal-stack` monorepo under
`services/assistant-api`, `services/assistant-ui`, `services/agent-gateway`, and
`services/agent-runner`. The product is about **agents**, not an "assistant", and
the stack is coherent enough to own its own release cadence. This feature stands
up `ExtraToast/agents` as the home for that stack, renames the misleading
"assistant" identifiers to "agents", and rewires `personal-stack` to consume the
released images/artifacts instead of building them in-tree.

This is the foundation the session-persistence (spec 002) and UI redesign
(spec 003) work builds on; it must land first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The agent stack lives in its own repo (Priority: P1)

A maintainer works on the agent stack in a single repository whose CI, releases,
and versioning are scoped to the agents, independent of the rest of the homelab.

**Why this priority**: Everything else depends on the stack having a stable home
and release process. Independently shippable: the repo can build, test, and
release the four components with no remaining dependency on `personal-stack`.

**Independent Test**: Clone `ExtraToast/agents`, run its CI locally/in-PR — the
two JVM services, the gateway, and the runner image all build and test green; a
release produces versioned, consumable artifacts.

**Acceptance Scenarios**:

1. **Given** the new repo, **When** CI runs on a PR, **Then** it lints, tests,
   and builds all four components and terminates in the single `Pipeline
   Complete` aggregator (the only required check), using reusable workflows from
   `ExtraToast/github-workflows`.
2. **Given** a merge to `main`, **When** release automation runs, **Then**
   release-please cuts a versioned release and the component images/artifacts are
   published for consumers to pin.
3. **Given** the repo, **When** its config is validated in CI, **Then** the
   shared-library and convention-plugin dependencies resolve from their published
   versions (no path/in-tree references to `personal-stack`).

### User Story 2 - "assistant" is renamed to "agents" everywhere (Priority: P1)

A user and a maintainer see consistent "agents" naming: the services are
`agents-api` and `agents-ui`, the routes/hosts, image names, deployment names,
config keys, and code identifiers reflect "agents" rather than "assistant".

**Why this priority**: The rename is the point of the move and must be complete
and consistent or it leaves confusing half-renamed surfaces.

**Independent Test**: Grep the new repo and the consuming `personal-stack` config
for "assistant" — only intentional historical references remain (e.g. changelog
notes); the running service, its host, and its image are "agents".

**Acceptance Scenarios**:

1. **Given** the extracted code, **When** built and deployed, **Then** the API
   service is `agents-api` and the UI is `agents-ui` (image names, k8s
   Deployment/Service names, and the public host all say "agents").
2. **Given** the rename, **When** the UI calls the API, **Then** the API base
   path and any user-facing labels use "agents" and nothing breaks (auth, CSRF,
   routing intact).
3. **Given** persisted data and existing sessions, **When** the rename ships,
   **Then** there is a defined migration/compatibility story for any renamed DB
   schema, config keys, or stored identifiers (no silent data loss).

### User Story 3 - personal-stack consumes the released agents stack (Priority: P1)

The homelab operator continues to run the agents stack from `personal-stack`'s
GitOps, but it now deploys released `agents` images pinned to a version, rather
than building from in-tree source.

**Why this priority**: The move is only "done" when the operator's cluster runs
the extracted stack with no regression.

**Independent Test**: `personal-stack` renders + validates with the
`assistant-*` services removed and the `agents-*` images referenced; the
deployed cluster serves the agents UI/API at the agents host with auth working.

**Acceptance Scenarios**:

1. **Given** `personal-stack`, **When** the `services/assistant-*` (and the moved
   gateway/runner) sources are removed and the agents images are referenced,
   **Then** `fleet.yaml` render + `platform:tooling` validation + Flux kustomize
   all pass.
2. **Given** the public-service wiring, **When** the rename lands, **Then**
   `auth-api` `ServicePermission`, the `app-ui` service registry/icon, and the
   DNS/Traefik host are updated from "assistant" to "agents" consistently.
3. **Given** the cut-over, **When** the operator reconciles, **Then** the agents
   UI is reachable at its (renamed) host behind SSO with no broken links from
   MyApps.

### Edge Cases

- Existing chat/agent sessions, workspaces, and persisted rows created under the
  "assistant" naming/schema — must keep working or be migrated, not orphaned.
- The runner image and gateway are referenced by the API by image name / in-pod
  path; those references must move together so a renamed runner still launches.
- Secrets/Vault paths, GitHub App token minting, and deploy keys used by the
  runner must be re-pointed if their names encode "assistant".
- CI for the consuming `personal-stack` must not still expect the in-tree
  `assistant-*` build (contract checks, system-tests, coverage gates).
- Cross-repo OpenAPI contract: the UI's generated types must track the API spec
  within the new repo (no dependency on the old in-tree contract job).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `agents` repo MUST be scaffolded from the latest
  `ExtraToast/repo-template` (rulesets, CI shape with a single `Pipeline
  Complete` aggregator, release-please, renovate, issue/PR templates, docs,
  docker patterns).
- **FR-002**: The four components — `agents-api` (was `assistant-api`),
  `agents-ui` (was `assistant-ui`), `agent-gateway`, `agent-runner` — MUST be
  moved into the `agents` repo, **preserving git history** where feasible.
- **FR-003**: CI MUST build, lint, and test all four components and reuse
  `ExtraToast/github-workflows` reusable workflows/composite actions rather than
  bespoke inline jobs where an equivalent reusable workflow exists.
- **FR-004**: Versioning/releases MUST use release-please as configured by the
  template, producing consumable, pinnable artifacts (container images for the
  services/runner; the OpenAPI/types contract internal to the repo).
- **FR-005**: Shared code MUST be consumed from the published shared libraries
  (`gradle-conventions`, `kotlin-spring-commons`, `vue-web-commons`,
  `openapi-client-gradle`) and the platform toolkit
  (`@extratoast/deploy-config-schema`) — no path or in-tree references back to
  `personal-stack`.
- **FR-006**: All "assistant" identifiers that name the product/service MUST be
  renamed to "agents": service/image/Deployment/Service names, public host, API
  base path, config/property prefixes, and code packages/classes where they
  encode "assistant". Historical/changelog references may remain.
- **FR-007**: A migration/compatibility story MUST be defined and applied for any
  renamed persistent surface (DB schema/table/column names, config keys, stored
  session identifiers, Vault paths) so existing data and in-flight sessions are
  not lost.
- **FR-008**: `personal-stack` MUST be updated to remove the in-tree
  `assistant-*` (+ moved gateway/runner) sources and instead deploy the released
  `agents` images, with `fleet.yaml` render, `platform:tooling` validation, and
  Flux kustomize all passing.
- **FR-009**: The public-service alignment in `personal-stack` MUST be updated
  consistently for the rename: `auth-api` `ServicePermission`, `app-ui` service
  registry + icon, and DNS/Traefik host.
- **FR-010**: The OpenAPI contract gate (spec ↔ generated TS types) MUST live
  within the `agents` repo so the UI and API stay in sync there.
- **FR-011**: The cut-over MUST be reviewable as small stacked PRs (scaffold →
  extract+rename → personal-stack consume), each independently green.

### Key Entities *(include if feature involves data)*

- **agents-api**: the JVM service formerly `assistant-api` (sessions, workspaces,
  RAG, gateway orchestration, streaming chat).
- **agents-ui**: the Vue UI formerly `assistant-ui`.
- **agent-gateway**: in-pod JVM service owning the tmux PTY + log tailer.
- **agent-runner**: the container image the agent runs in (CLIs, MCP, token
  helpers).
- **Renamed persistent surfaces**: DB schema/tables, config-property prefixes,
  Vault paths, public host — each needs a rename + migration entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `ExtraToast/agents` CI is green for all four components and a
  release is published; the repo has zero build/test references to
  `personal-stack`.
- **SC-002**: A repo-wide grep finds no product/service-naming use of
  "assistant" (only intentional historical mentions).
- **SC-003**: `personal-stack` renders + validates + Flux-kustomizes green with
  `assistant-*` removed and `agents-*` images referenced.
- **SC-004**: The agents UI is reachable at its renamed host behind SSO from
  MyApps, API + auth + streaming working, with no regression vs the pre-move
  behavior.
- **SC-005**: Existing sessions/workspaces/rows created pre-rename remain
  functional (or are migrated) — no data loss.

## Assumptions

- The whole agent stack (api, ui, gateway, runner) moves together (confirmed).
- History-preserving extraction (e.g. `git filter-repo`/subtree) is preferred but
  may fall back to a clean import if history extraction proves impractical for a
  given path; the decision is recorded in the plan.
- `personal-stack` keeps owning cluster GitOps and consumes released `agents`
  images pinned by Flux — the established shared-repo consumption model.

## Non-Goals

- The session-persistence/restart-with-history feature (spec 002).
- The agents-view UI redesign (spec 003).
- Changing agent capabilities, the set of CLIs/MCP tools, or auth model.
