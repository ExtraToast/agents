# Feature Specification: GitHub App-only repository access

**Feature Branch**: `025-github-app-only-repository-access`
**Created**: 2026-06-24
**Status**: Draft
**Input**: User description: "Analyse whether we still need to attach deploy keys to repos in the agents UI/API now that the installed GitHub App handles access. Redesign to remove the deploy-key requirement and instead give users live install links and live install status for the GitHub App on each repo they add."

## Context & Problem

Adding a repository to the agents platform today is a two-step chore: the user
creates the repo entry, then must generate an SSH keypair, paste it into an
"Attach key" wizard, and separately add the public half as a deploy key on
GitHub. The platform stores the private key in its secret store and mounts it
into every runner so it can clone over SSH.

That requirement is now redundant. The platform already operates an installed
GitHub App (`jorisjonkers-dev-agents`) that mints short-lived, repo-scoped
installation tokens. Runners already use those tokens over HTTPS to push, open
pull requests, and re-run Actions, and additional workspace repositories already
clone over HTTPS with no deploy key at all. Only the *primary* repository's
first clone still falls back to the SSH deploy key. Deploy keys are therefore a
legacy second credential that adds setup friction, spreads long-lived private
keys across the secret store and every runner pod, and duplicates access the App
already grants.

This feature removes the deploy-key requirement entirely and makes installing
the GitHub App the single, self-service way to wire a repository for agent
access — backed by live install links and a live "is the App installed for this
repo?" status so the user always knows whether a repo is ready.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a repo and get it working without a deploy key (Priority: P1)

A user adds a repository to the platform. On the very next screen they are shown
a one-click link to install (or add this repository to) the GitHub App on the
repository's owner, and a clear statement of what access the App grants. After
they install the App on GitHub, agent sessions for that repository can clone,
push, open pull requests, and trigger Actions — without the user ever generating
or pasting an SSH key.

**Why this priority**: This is the entire point of the change. It removes the
mandatory deploy-key step and is the minimum that delivers user value: a repo
becomes usable through the App alone.

**Independent Test**: Add a repository whose owner has the App installed, start
an agent session against it, and confirm clone/push/PR/Actions all succeed with
no deploy key configured anywhere. Separately, confirm the UI no longer presents
any "attach key" / "paste SSH key" step in the add-repo flow.

**Acceptance Scenarios**:

1. **Given** a freshly added repository, **When** the user lands on the
   post-add screen, **Then** they see an actionable "Install the GitHub App on
   `<owner>`" (or "add this repository") link and a summary of the access the
   App will have, and they see no field or wizard asking for an SSH/deploy key.
2. **Given** a repository whose owner already has the App installed with access
   to it, **When** an agent session runs against that repository, **Then** the
   runner clones, pushes, opens PRs, and triggers Actions successfully using the
   App, with no deploy-key secret mounted.
3. **Given** the platform, **When** a user inspects any repository or the add
   flow, **Then** there is no path to attach, replace, or view a deploy key, and
   no API endpoint accepts deploy-key material.

---

### User Story 2 - See live whether the App is installed for a repo (Priority: P2)

When a user adds a repo (and whenever they view a repository's detail), the
platform shows a live status telling them whether the GitHub App is actually
installed and able to access that specific repository. If it is not, the status
makes the gap obvious and offers the install link; once the user installs the
App on GitHub, a re-check updates the status to "ready".

**Why this priority**: Without live status the user cannot tell whether the
install link they clicked actually worked, turning a self-service flow into
guesswork. It is the difference between "here is a link, good luck" and a
guided, verifiable setup. It builds on Story 1 but is separable: Story 1 can
ship with static links first.

**Independent Test**: For a repo whose owner has not installed the App, confirm
the status reads "not installed" with an install link. Install the App on
GitHub, trigger a re-check, and confirm the status flips to "installed / ready"
without restarting an agent session.

**Acceptance Scenarios**:

1. **Given** a repository whose owner has not installed the App (or the
   installation excludes this repo), **When** the user views the repository,
   **Then** the status clearly shows the App is not yet able to access the repo
   and offers the install link.
2. **Given** a repository whose owner has installed the App with access to it,
   **When** the user views the repository, **Then** the status clearly shows the
   App is installed and can access the repo.
3. **Given** a "not installed" status, **When** the user installs the App on
   GitHub and uses the re-check action, **Then** the status updates to reflect
   the new state without requiring an agent session or a page rebuild.
4. **Given** GitHub or the App backend is temporarily unreachable, **When** the
   status is requested, **Then** the user sees an explicit "could not determine"
   state with a retry option, not a false "installed" or a silent failure.

---

### User Story 3 - Retire deploy-key storage and correct the App identity (Priority: P3)

The platform removes the now-dead deploy-key data and configuration: stored
private keys, the fingerprint/added-at/key-path attributes on repositories, and
the SSH-key plumbing in runner provisioning. It also corrects the App's
published identity so every install/manage link points at the current App
(`jorisjonkers-dev-agents`) and the displayed "requested permissions" match what
the App actually requests.

**Why this priority**: This is cleanup and correctness. It is not required for a
user to add a repo via the App, but leaving stale links and orphaned private
keys is a security and trust liability. It can follow Stories 1–2.

**Independent Test**: Confirm no repository record retains deploy-key
attributes, no secret store path holds platform-managed deploy keys, runner
pods mount no deploy-key secret, every App link in the UI resolves to the
`jorisjonkers-dev-agents` App, and the displayed permission list matches the
access the App requests.

**Acceptance Scenarios**:

1. **Given** the migrated platform, **When** a repository record is inspected,
   **Then** it carries no deploy-key fingerprint, added-at timestamp, or
   secret-path attribute, and provisioning a runner creates no deploy-key
   secret.
2. **Given** any App link in the UI (install, manage installations, permissions),
   **When** the user follows it, **Then** it targets the `jorisjonkers-dev-agents`
   App and (for install) is pre-scoped to the relevant owner.
3. **Given** the post-add and repository-detail screens, **When** the user reads
   the "access the App will have" summary, **Then** it lists exactly the
   permissions the App requests (no more, no fewer).

### Edge Cases

- **Owner cannot install the App** (e.g. a personal account or an org with a
  policy that blocks it): the status must distinguish "not installed" from
  "cannot be installed here" where detectable, and direct the user to the right
  place rather than implying a one-click fix that will fail.
- **Repository URL is not a parseable GitHub repo** (unexpected host, malformed
  URL): the platform cannot build an install link or check status and must say
  so plainly instead of showing a broken link or a misleading status.
- **App installed on the owner but the specific repo is excluded** from the
  installation's selected repositories: status must read "not able to access
  this repo" (with guidance to add the repo to the installation), not a blanket
  "installed".
- **Existing repositories that still have a deploy key attached** at migration
  time: they must keep working through the App and must not break; their stale
  deploy-key data is removed without manual user action.
- **Legacy per-project repository links** (the older project-scoped link model)
  must not regress: any repository reachable today stays reachable via the App.
- **GitHub rate limiting / transient errors** on the status check: surfaced as
  an indeterminate state with retry, never cached as a definitive answer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The add-repository flow MUST NOT require, request, or accept SSH
  deploy-key material at any step.
- **FR-002**: The platform MUST remove every user-facing path to attach,
  replace, or view a deploy key, and MUST remove the corresponding API
  capability so no deploy-key material can be submitted.
- **FR-003**: Immediately after a repository is added, the user MUST be presented
  with an actionable link to install the GitHub App on (or add the repository to
  the App for) that repository's owner.
- **FR-004**: The platform MUST display, for a given repository, a live status
  indicating whether the GitHub App is installed and able to access that
  specific repository, distinguishing at minimum: installed-and-able,
  not-installed/not-able, and indeterminate (could not be checked).
- **FR-005**: The status check MUST determine installation/access without
  minting or exposing any access token, and MUST be re-runnable on demand
  ("re-check") so a user can confirm the result of installing the App.
- **FR-006**: Agent sessions MUST be able to clone, fetch, push, open pull
  requests, and trigger Actions for any repository the App can access, using the
  App's credentials over HTTPS, with no deploy-key secret provisioned to the
  runner.
- **FR-007**: Repositories whose stored URL uses the SSH form
  (`git@github.com:owner/repo`) MUST continue to work without the user editing
  the URL.
- **FR-008**: Runner provisioning MUST NOT create, mount, or depend on any
  deploy-key secret, and MUST NOT depend on a cluster-wide deploy-key fallback.
- **FR-009**: The migration MUST drop the deploy-key attributes (fingerprint,
  added-at, key path) from repository records AND best-effort delete the stored
  deploy-key private material from the secret store, such that no
  platform-managed deploy keys remain after migration. A secret-store deletion
  that fails MUST NOT block the migration, but MUST be logged for follow-up.
- **FR-010**: Existing repositories MUST remain usable for agent sessions after
  this change with no manual re-setup. Legacy project-scoped repository links
  MUST be kept readable (so workspaces bound to them keep working) but MUST lose
  their deploy-key fields and MUST NOT be a path for attaching new keys; they are
  not migrated into the unified repository model in this feature.
- **FR-011**: All GitHub App links the platform presents (install, manage
  installations, view permissions) MUST resolve to the current App identity
  (`jorisjonkers-dev-agents`), and install links MUST be pre-scoped to the
  relevant repository owner.
- **FR-012**: The "access the App will have" summary shown to users MUST match
  the exact set of permissions the App actually requests, and MUST stay
  consistent across every place the platform displays it.
- **FR-013**: When a repository URL cannot be parsed as a GitHub repository, the
  platform MUST clearly indicate that install links and status are unavailable
  rather than presenting a broken link or a misleading status.
- **FR-014**: When the App's permissions have changed but an existing
  installation has not yet approved them, the platform SHOULD make clear that
  approval on the installation is required before the new access takes effect.
- **FR-015**: The platform MUST remove the deploy-key read/write access probe
  (the gateway-backed read/write check). The App install-status MUST be the
  repository access-readiness signal in its place.
- **FR-016**: The platform MUST retain the GitHub branch-protection check for a
  repository's default branch and present it together with the App install-status
  as one unified repository status surface, so a user sees both "App can access
  this repo" and "default branch is protected" in one place.

### Key Entities *(include if feature involves data)*

- **Repository**: A GitHub repository registered for agent use. Retains its
  identity, display name, URL, and default branch. Loses all deploy-key
  attributes (fingerprint, added-at, secret path). Gains an association to a
  derived/queried **App installation status** (not necessarily stored).
- **GitHub App installation status**: A live, queried fact about whether the
  platform's GitHub App is installed for a repository's owner and can access the
  specific repository. Values include installed-and-able, not-installed/not-able,
  and indeterminate. Live, not authoritative storage.
- **Repository status surface**: The unified, user-facing readiness view for a
  repository, combining the App install-status (access signal) with the retained
  branch-protection check for the default branch. Replaces the former
  deploy-key-centric access-verification view.
- **GitHub App identity & requested access**: The single source of truth for the
  App's slug/identity and the set of repository permissions it requests, used to
  render install/manage links and the access summary consistently.
- **Legacy deploy key (removed)**: Previously a per-repository private key in the
  secret store plus repository attributes. Retired by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can take a repository whose owner has the App installed
  from "added" to "agent session successfully pushes a branch and opens a PR"
  without generating, pasting, or configuring any SSH key.
- **SC-002**: Zero steps in the add-repository flow ask for key material; the
  count of credential-entry fields in that flow is 0.
- **SC-003**: For a repository, a user can tell within one screen — and confirm
  after installing — whether the App can access it, via a status that updates on
  re-check without starting an agent session.
- **SC-004**: After migration, no repository record carries deploy-key
  attributes and no runner pod is provisioned with a deploy-key secret.
- **SC-005**: 100% of GitHub App links presented in the UI resolve to the
  `jorisjonkers-dev-agents` App, and the displayed permission summary matches the
  App's actual requested permissions exactly.
- **SC-006**: Repositories that worked before the change (including SSH-URL and
  legacy project-linked ones) still run agent sessions successfully after it,
  with no user re-setup.

## Assumptions

- The GitHub App `jorisjonkers-dev-agents` is installed (or installable) on the
  owners of the repositories users add, and its requested permissions already
  cover clone/push/PR/Actions/issues/workflows needs (this feature does not
  change the App's permission set — a non-goal).
- A manual "re-check status" action is acceptable for v1; the platform does not
  need a web callback that auto-detects when a user finishes installing the App
  on GitHub (non-goal).
- Only GitHub remotes are in scope; non-GitHub hosts are out of scope
  (non-goal).
- Installation-status checks are best-effort against GitHub's live state and may
  be subject to rate limits; an indeterminate result is an acceptable outcome,
  not a failure to design around.

## Non-Goals

- Changing the GitHub App's permission set.
- Supporting non-GitHub remotes.
- Building an OAuth/web callback that automatically detects installation
  completion.
- Migrating or rotating existing deploy keys beyond removing the requirement and
  cleaning up their storage.

## Clarifications

### Session 2026-06-24

- **Q (data cleanup, OQ-1)**: Delete stored deploy-key secrets and drop the
  deploy-key columns during migration, or defer? → **A**: Drop the columns and
  best-effort delete the stored private keys during migration (see FR-009).
- **Q (legacy links, OQ-2)**: Retire the legacy project-scoped repository link
  model, or keep it read-only? → **A**: Keep legacy links read-only with key
  fields stripped; do not migrate them into the unified model here (see FR-010).
- **Q (status UX, OQ-3)**: Manual re-check, or background polling? → **A**: v1
  uses a manual "re-check" action; no polling and no auto-detect callback.
- **Q (un-installable owners, OQ-4)**: How much to invest in explaining owners
  where the App can't be installed? → **A**: Show a single generic
  "not installed — install the App" message with the install link; rely on
  GitHub's own errors during install. The "repo excluded from installation" and
  "unparseable URL" states from Edge Cases remain distinct.
- **Q (verification overlap)**: With deploy keys gone, what happens to the
  existing repository access-verification (deploy-key read/write probe via the
  gateway + branch-protection check, shown via the access-status badge and the
  re-verify action)? → **A**: Remove the deploy-key read/write probe; the App
  install-status becomes the access signal. Retain the independent
  branch-protection check and fold it into the unified repository status surface
  (see FR-015, FR-016).
