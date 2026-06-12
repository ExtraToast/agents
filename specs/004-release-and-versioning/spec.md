# Feature Specification: First release and image versioning convention

**Feature Branch**: `004-release-and-versioning`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Cut the first `agents` release so the GHCR images referenced by the
`personal-stack` cut-over exist, and lock in the image versioning/consumption
convention.

## Overview

The extracted `agents` repository must publish real, versioned container images
before `personal-stack` can consume the stack from GHCR. The release path is
intended to be simple: release-please opens a release PR from conventional commits
on `main`; merging that PR creates the release tag; the release workflow publishes
the four component images (`agents-api`, `agents-ui`, `agent-gateway`,
`agent-runner`) with immutable version tags.

This feature makes the first release usable by the consuming GitOps repository
and records the long-term convention for image consumption. The preferred
convention is Flux manifests pinned to a released tag, with Renovate proposing
tag bumps. `:latest` plus Keel is not the default consumption model unless a
planning decision explicitly reverses that preference.

This work depends on the extraction/rename baseline from spec 001: the four
components and their release workflow must already live in `agents`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Release automation opens the release PR (Priority: P1)

A maintainer merges conventional commits to `main` and release-please opens or
updates the release PR without manual changelog/version editing.

**Why this priority**: The first release cannot be cut safely until the release
automation behaves predictably on `main`.

**Independent Test**: Inspect the release workflow run after the extraction
`feat:` commit (or a controlled conventional commit) and confirm that
release-please opens/updates a release PR, or that the failure mode is repaired
and re-run successfully.

**Acceptance Scenarios**:

1. **Given** a releasable conventional commit on `main`, **When** the release
   workflow runs, **Then** release-please opens or updates a release PR with the
   expected changelog and version state.
2. **Given** release-please does not open a PR, **When** the workflow,
   release-please manifest/config, token source, and repository permissions are
   inspected, **Then** the blocking cause is identified and repaired rather than
   bypassed by hand-editing release artifacts.
3. **Given** the release PR is opened by the configured automation token,
   **When** branch protection evaluates it, **Then** required checks can run and
   the PR is mergeable after the normal CI gates pass.

---

### User Story 2 - First release publishes immutable GHCR images (Priority: P1)

A maintainer merges the release PR and the release workflow creates the release
tag, GitHub release, and pullable GHCR images for every runtime component.

**Why this priority**: `personal-stack` cannot cut over to released artifacts
until every referenced image exists at a stable tag.

**Independent Test**: Merge the release PR in a controlled run; verify the tag,
release, and all four image tags exist in GHCR and can be pulled by an equivalent
consumer identity.

**Acceptance Scenarios**:

1. **Given** the release PR is merged, **When** release-please creates the
   release, **Then** a release tag is created for the intended first `agents`
   release version.
2. **Given** the release tag exists, **When** the image publishing job runs,
   **Then** GHCR contains `ghcr.io/extratoast/agents/agents-api:<tag>`,
   `ghcr.io/extratoast/agents/agents-ui:<tag>`,
   `ghcr.io/extratoast/agents/agent-gateway:<tag>`, and
   `ghcr.io/extratoast/agents/agent-runner:<tag>`.
3. **Given** the published tags, **When** a deployment-capable consumer pulls
   them, **Then** all four images are pullable with the expected platform
   support from the release workflow.

---

### User Story 3 - personal-stack consumes released tags (Priority: P2)

The GitOps deployment references released `agents` image tags that are stable,
reviewable, and automatically bumpable by Renovate.

**Why this priority**: The release is only useful if the consuming deployment
can pin and update it without relying on mutable tags.

**Independent Test**: Update the consuming deployment path to reference the
released tag; run the relevant `personal-stack` render/validation/reconcile
checks and confirm the cluster can pull and start the released images.

**Acceptance Scenarios**:

1. **Given** a published release tag, **When** `personal-stack` references the
   `agents` images, **Then** it pins the released tag rather than `:latest`.
2. **Given** a later `agents` release, **When** Renovate evaluates the consuming
   manifests, **Then** it can propose an image tag bump as a reviewable change.
3. **Given** the cut-over manifests are reconciled, **When** the cluster deploys
   the stack, **Then** the pods pull the released images and the agents UI/API
   come up without falling back to in-tree builds.

### Edge Cases

- release-please may be correctly configured but unable to open a PR because the
  automation App lacks repository `contents` or pull request permissions.
- A release PR opened with a fallback token may not trigger required CI in a way
  that satisfies branch protection; this must be handled as a release automation
  issue, not as a reason to weaken checks.
- The current release-please manifest may not match the roadmap's intended first
  release version; this must be resolved before cutting a public tag.
- GHCR package permissions or visibility may allow publishing but prevent the
  deployment identity from pulling the images.
- `agents-ui` requires the platform support needed by its target nodes; the
  released manifest list must match the deployment placement.
- A mutable `latest` tag may exist for convenience, but GitOps consumption must
  not depend on it under the pinned-tag convention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Release automation MUST run from `.github/workflows/release.yml` on
  pushes to `main` and use `release-please-config.json` plus
  `.release-please-manifest.json` as the release state.
- **FR-002**: release-please MUST open or update a release PR after a releasable
  conventional commit lands on `main`; if it does not, the workflow/config/token
  and automation App permissions MUST be investigated and repaired.
- **FR-003**: The first intended `agents` release MUST create tag `v0.1.0`.
  [NEEDS CLARIFICATION: `.release-please-manifest.json` currently records `.`
  as `0.2.2`, while the roadmap expects `v0.1.0`; planning must determine
  whether the manifest is stale/template state or the roadmap version needs
  correction before any public tag is cut.]
- **FR-004**: Merging the release PR MUST create the GitHub release/tag through
  release-please rather than by hand-building the changelog and tag.
- **FR-005**: The release workflow MUST publish immutable GHCR image tags matching
  the release tag for `agents-api`, `agents-ui`, `agent-gateway`, and
  `agent-runner`.
- **FR-006**: Published image repositories MUST match the repo release workflow:
  `ghcr.io/extratoast/agents/agents-api`,
  `ghcr.io/extratoast/agents/agents-ui`,
  `ghcr.io/extratoast/agents/agent-gateway`, and
  `ghcr.io/extratoast/agents/agent-runner`.
- **FR-007**: Published images MUST be pullable by the identities used by the
  consuming deployment and MUST include the platform support required by their
  deployment targets.
- **FR-008**: The documented consumption convention MUST be Flux manifests pinned
  to released image tags with Renovate auto-bump PRs; `:latest` plus Keel MUST
  NOT be the default consumption path unless a later decision records a reversal.
- **FR-009**: The `personal-stack` cut-over work MUST align its manifests with
  the documented convention and MUST verify the released images deploy
  successfully there.
- **FR-010**: The repository MUST use one release version for all four components
  unless planning explicitly chooses per-component versions.
  [NEEDS CLARIFICATION: the current release-please config uses `release-type:
  simple` for a single root package, while the roadmap leaves single repo version
  versus per-component versions open.]
- **FR-011**: Release documentation or planning notes MUST record the resolved
  versioning convention, the cause of any release-please repair, and the exact
  first release tag consumed by `personal-stack`.

### Key Entities *(include if feature involves data)*

- **Release PR**: the release-please pull request containing version/changelog
  updates for the next `agents` release.
- **Release tag**: the immutable Git tag created by merging the release PR
  (intended first release: `v0.1.0`, subject to the manifest clarification).
- **GHCR image**: one published container image per runtime component:
  `agents-api`, `agents-ui`, `agent-gateway`, and `agent-runner`.
- **Consumption convention**: the documented rule for deployment references:
  Flux pins released image tags and Renovate proposes bumps.
- **Deployment consumer**: the `personal-stack` GitOps manifests and cluster
  identities that pull and run the released `agents` images.
- **Release automation App**: the token source used by the release workflow when
  opening release PRs and publishing release artifacts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A releasable commit on `main` results in a release-please PR, or a
  repaired workflow run demonstrates the PR opens successfully after the root
  cause is fixed.
- **SC-002**: Merging the release PR creates the intended first release tag and
  GitHub release without manual changelog/tag construction.
- **SC-003**: 100% of required images (`agents-api`, `agents-ui`,
  `agent-gateway`, `agent-runner`) are present in GHCR at the release tag and are
  pullable by a deployment-equivalent identity.
- **SC-004**: `personal-stack` references released `agents` image tags and does
  not rely on `:latest` or Keel for the cut-over.
- **SC-005**: `personal-stack` render/validation/reconcile checks pass with the
  released images, and the deployed agents UI/API start successfully from GHCR.
- **SC-006**: The single-version versus per-component-version decision is
  recorded before future releases depend on the convention.

## Open Questions

- Why did release-please not open the expected release PR after the extraction
  `feat:` commit: release-please config/manifest state, workflow behavior, token
  fallback, or automation App `contents`/pull request permissions?
- Should the repository keep one simple repo version for all components, matching
  the current template-style release-please config, or adopt per-component
  versions?
- Is the intended first public tag still `v0.1.0`, or must the current
  release-please manifest value be reconciled to a different first-release path?

## Assumptions

- Spec 001 has already established the standalone `agents` repository and the
  four releasable components.
- The release workflow remains the source of truth for published GHCR repository
  names and platform matrix.
- Flux-pinned released tags plus Renovate auto-bumps is the desired consumption
  convention unless explicitly overturned during planning.
- `personal-stack` owns cluster GitOps and deployment verification for the
  cut-over, while this feature owns making the `agents` release artifacts real
  and consumable.

## Non-Goals

- Implementing the extraction/rename baseline from spec 001.
- Implementing session persistence/restart behavior from spec 002.
- Implementing the agents UI redesign from spec 003.
- Redesigning the release workflow beyond what is necessary to cut and consume
  the first release.
- Replacing Flux/Renovate with Keel or another deployment automation model.
