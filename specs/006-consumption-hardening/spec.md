# Feature Specification: personal-stack consumption hardening

**Feature Branch**: `006-consumption-hardening`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Harden `personal-stack`'s consumption of the external `agents` stack:
pin the Flux `stateless/agents-*` deployments to released `agents` versions
instead of `:latest`, wire automated upgrades, avoid duplicate Keel/Renovate
management, verify the deployed pods against `personal-stack` infrastructure,
and document the consume/upgrade flow.

## Overview

`personal-stack` is the implementation target for this feature; this spec is
authored in the agents roadmap. After the extraction work, `personal-stack`
consumes the external `agents` stack from GHCR rather than building the services
in-tree. The current consumption surface observed in `personal-stack` includes
Flux manifests for `agents-api`, the Enschede-pinned `agents-api-ws` replica,
`agents-ui`, and a dynamic `agent-runner` image reference used by `agents-api`.
Those refs currently use `:latest` and Keel annotations.

This feature makes that consumption robust and maintainable by pinning the
agents images to released versions, wiring an automatic bump path, and ensuring
only one system owns upgrades for those images. It also proves that the released
stack still runs correctly against the `personal-stack` Vault, database, and
Traefik integration, then records the operator-facing upgrade and rollback flow.

Depends on spec 004, because a released `agents` version and the final
versioning convention must exist before this work can be completed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - personal-stack consumes a released agents version (Priority: P1)

The operator can inspect `personal-stack` GitOps and see exactly which released
`agents` version is deployed for every agents component. The running cluster is
not dependent on a mutable `:latest` tag.

**Why this priority**: Reproducible operations require a known deployed version.
This is the core hardening goal and the prerequisite for reliable upgrade and
rollback.

**Independent Test**: Inspect the `personal-stack` Flux manifests after the
change. All production agents image refs point to released tags or digests, no
agents production ref uses `:latest`, and the API/UI/runner refs form one
coherent released version set.

**Acceptance Scenarios**:

1. **Given** spec 004 has published the first released agents images, **When**
   `personal-stack` is updated, **Then** `agents-api`, `agents-api-ws`,
   `agents-ui`, and the dynamic `agent-runner` image reference point to released
   agents image refs rather than `:latest`.
2. **Given** the release publishes multiple component images, **When** the
   production manifests are reviewed, **Then** each consumed image is pinned to a
   compatible release set and mismatched API/UI/runner versions are either
   prevented or explicitly justified.
3. **Given** a rollback is needed, **When** the prior GitOps revision is applied,
   **Then** the cluster returns to the prior known agents release instead of
   resolving a moving tag.

---

### User Story 2 - agents upgrades have one automation authority (Priority: P1)

The operator receives a reviewable bump when a new released agents version is
available. Keel and Renovate do not both manage the same agents image refs.

**Why this priority**: Duplicate automation can roll unreviewed image changes or
fight GitOps state. A single upgrade authority keeps changes auditable and
matches the shared-repos consumption model.

**Independent Test**: Release a newer agents version or simulate Renovate/image
metadata input. Exactly one configured mechanism proposes or applies the
personal-stack image update, and the other mechanism is absent or explicitly out
of scope for those refs.

**Acceptance Scenarios**:

1. **Given** a new released agents version exists, **When** dependency automation
   runs, **Then** a bump is proposed through the selected mechanism
   ([NEEDS CLARIFICATION: Renovate PR, Flux image automation commit, or another
   approved mechanism]).
2. **Given** Renovate is selected, **When** the agents manifests are inspected,
   **Then** Keel no longer manages the agents production refs, while unrelated
   in-house images may keep their existing Keel behavior.
3. **Given** Keel is selected instead, **When** the agents manifests and
   Renovate config are inspected, **Then** Renovate does not also manage those
   same image refs, and the reproducibility tradeoff is documented.

---

### User Story 3 - released agents pods run against personal-stack infrastructure (Priority: P1)

After the pinned release is reconciled, the agents pods become Ready using the
existing `personal-stack` Vault, database, and Traefik wiring. The retained
`agents-api` Vault policy remains sufficient.

**Why this priority**: Version pinning is only useful if the released external
images still operate in the real consuming cluster.

**Independent Test**: Reconcile the updated `personal-stack` Flux state in the
target cluster, then verify agents rollout readiness, API health, Vault-injected
configuration, database connectivity, and the public `agents.<domain>` route.

**Acceptance Scenarios**:

1. **Given** the pinned agents refs have been reconciled, **When** Kubernetes
   rollout status is checked, **Then** `agents-api`, `agents-api-ws`, and
   `agents-ui` reach Ready without CrashLoopBackOff or image-pull failures.
2. **Given** `agents-api` starts, **When** its health and startup logs are
   checked, **Then** Vault injection succeeds, database connectivity succeeds,
   and the retained `agents-api` Vault policy does not require broadening beyond
   the documented agents needs.
3. **Given** Traefik has reconciled, **When** `agents.<domain>` is opened through
   the normal authenticated path, **Then** the UI loads, API calls succeed, and
   the session attach path remains reachable.

---

### User Story 4 - the consume/upgrade flow is documented (Priority: P2)

A maintainer can follow a concise runbook to consume the first agents release,
accept future upgrades, validate the deployment, and roll back if needed.

**Why this priority**: The new cross-repo operating model needs to be repeatable
after the initial cut-over, not held in one-off change context.

**Independent Test**: Follow the documented flow on a fresh agents release. The
steps identify the source release, show how the bump reaches `personal-stack`,
list validation checks, and describe rollback.

**Acceptance Scenarios**:

1. **Given** a new agents release is available, **When** the runbook is followed,
   **Then** the correct `personal-stack` version refs are updated through the
   selected automation path.
2. **Given** the bump has merged, **When** validation begins, **Then** the
   runbook covers Flux reconcile status, pod readiness, health checks, and the
   `agents.<domain>` smoke check.
3. **Given** the release is unhealthy, **When** rollback is needed, **Then** the
   runbook identifies the GitOps rollback path and the expected post-rollback
   checks.

### Edge Cases

- A released agents version publishes some but not all required component images.
- API, UI, and runner refs drift to incompatible releases.
- The dynamic runner image remains on `:latest` after the static deployments are
  pinned.
- Renovate and Keel both observe the same agents ref and race each other.
- A mutable tag is republished; pinned digests avoid this, but the selected
  strategy must define the expected behavior.
- The first pinned rollout fails because the external image lacks a runtime
  assumption that the in-tree image had.
- Vault injection succeeds but database credentials or migrations fail at
  application startup.
- Traefik routes reconcile while agents pods are not Ready, producing a public
  host that returns an edge error.
- Rollback to a prior agents release requires reverting both static deployment
  refs and the dynamic runner ref.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `personal-stack` production Flux refs for agents MUST use released
  `agents` image refs, not `:latest`.
- **FR-002**: The pinned image set MUST include `agents-api`, the Enschede-pinned
  `agents-api-ws` replica, `agents-ui`, and the `agent-runner` image ref used by
  `agents-api`; any direct `agent-gateway` image ref MUST follow the same
  convention if present.
- **FR-003**: The pinned image refs MUST use one coherent release set from spec
  004 ([NEEDS CLARIFICATION: single repo version for all components vs
  per-component versions]).
- **FR-004**: The selected pin format MUST be reproducible. Pinned digest plus a
  human-readable released tag is preferred; released tag only is acceptable only
  if spec 004 explicitly records that tradeoff.
- **FR-005**: `personal-stack` MUST have an automated bump path for the agents
  refs, using Renovate, Flux image automation, or another documented mechanism
  that produces auditable GitOps changes.
- **FR-006**: The agents refs MUST have exactly one upgrade authority. If
  Renovate or Flux image automation manages them, Keel MUST NOT manage those
  same refs. If Keel manages them, Renovate MUST NOT manage those same refs.
- **FR-007**: The upgrade automation MUST be maintainable in one clear source of
  truth ([NEEDS CLARIFICATION: `gradle/libs.versions.toml`-style catalog,
  Renovate regex manager against manifests, Flux image policy, or another
  personal-stack convention]).
- **FR-008**: The upgrade automation MUST group compatible agents component bumps
  so API, UI, runner, and gateway refs do not drift unless a deliberate
  per-component release model is selected.
- **FR-009**: `personal-stack` validation MUST confirm the rendered/reconciled
  manifests no longer contain production agents `:latest` refs after the change.
- **FR-010**: `agents-api` MUST continue to use the retained `agents-api` Vault
  role/policy and MUST start successfully with the `personal-stack` Vault and
  database configuration.
- **FR-011**: The deployment validation MUST verify Kubernetes readiness for
  `agents-api`, `agents-api-ws`, and `agents-ui`, plus image-pull success for
  any runner image started by `agents-api`.
- **FR-012**: The public route MUST be smoke-checked end-to-end at
  `agents.<domain>` through the normal Traefik/auth path, including at least one
  API request from the UI.
- **FR-013**: The consume/upgrade documentation MUST describe first adoption,
  future bump review, merge/reconcile, smoke checks, and rollback.
- **FR-014**: If any agents-facing route, catalog, or ingress artifact is
  render-managed in `personal-stack`, the implementation MUST update the owning
  source rather than hand-editing generated output.

### Key Entities *(include if feature involves data)*

- **Agents release**: The published release from the external `agents` repo that
  provides versioned images for the consumed components.
- **Agents image ref set**: The complete set of `personal-stack` image refs for
  `agents-api`, `agents-api-ws`, `agents-ui`, `agent-runner`, and any direct
  `agent-gateway` ref.
- **Upgrade authority**: The single mechanism allowed to move the agents image
  ref set forward in `personal-stack` GitOps.
- **Consumption runbook**: The documented flow for adopting, validating,
  upgrading, and rolling back released agents versions.
- **Runtime integration**: The `personal-stack` Vault, database, and Traefik
  dependencies that must remain compatible with the released agents images.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of `personal-stack` production Flux manifests finds zero
  `ghcr.io/extratoast/agents/*:latest` refs after the change.
- **SC-002**: Every production agents image ref resolves to a released agents tag
  or digest from spec 004, and all refs are compatible under the selected release
  model.
- **SC-003**: A newer agents release produces exactly one auditable
  `personal-stack` upgrade proposal or GitOps update through the selected
  automation path.
- **SC-004**: Keel and Renovate/Flux image automation do not both manage the same
  agents image refs.
- **SC-005**: After reconcile, `agents-api`, `agents-api-ws`, and `agents-ui`
  reach Ready, and `agents-api` reports healthy with Vault and database access
  working.
- **SC-006**: `agents.<domain>` loads through Traefik/auth, the UI can call the
  API, and the agents session attach path is smoke-checked.
- **SC-007**: The consume/upgrade documentation is sufficient for a maintainer to
  adopt a new release and roll back without relying on prior change context.

## Assumptions

- Spec 004 publishes the first consumable agents release and records the
  authoritative versioning convention before this feature is implemented.
- `personal-stack` remains the cluster GitOps owner and consumes `agents` as an
  external released stack.
- The preferred direction is pinned digest plus Renovate-managed bump PRs for
  reproducibility, unless spec 004 or operator decision chooses a different
  single-authority model.
- The existing `agents-api` Vault role/policy is retained and should not need to
  be broadened merely because image refs become pinned.
- Unrelated in-house `personal-stack` images may keep their existing deployment
  automation if the final strategy scopes only the external agents refs.

## Open Questions

- Moving tag plus Keel vs pinned digest plus Renovate: pinned digest plus
  Renovate is preferred for reproducibility, but spec 004 must confirm the final
  convention before implementation.
- Where should the agents version live in `personal-stack`: a central catalog,
  Renovate regex-managed manifests, Flux image policy resources, or another
  established convention?
- Does the agents release model use one repo-wide version for API/UI/gateway/
  runner, or separate component versions that must be grouped?
- Should Flux image automation be considered equivalent to Renovate for this
  case, or should Renovate be the only accepted bump mechanism?
- What exact smoke-check command set should be recorded for `agents.<domain>`
  ([NEEDS CLARIFICATION: domain and cluster access context])?

## Non-Goals

- Cutting the first `agents` release or repairing release-please; that belongs
  to spec 004.
- Changing agents runtime behavior, session durability, UI design, or API
  contracts.
- Replacing all Keel usage across `personal-stack` if only the external agents
  image refs need a different strategy.
- Redesigning `personal-stack` Vault, database, or Traefik architecture.
- Moving additional services out of `personal-stack`.
