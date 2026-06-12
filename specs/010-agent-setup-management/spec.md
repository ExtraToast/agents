# Feature Specification: Agent setup management

**Feature Branch**: `010-agent-setup-management`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Make "restart with an updated agent setup" first-class: define what
an agent setup is, let the operator pick/update it, and restart a durable
session into the new setup.

## Overview

Today a running session inherits the runner image, command-line tooling, MCP
profile, connector configuration, and tool exposure that happen to be configured
for the runner pod at start time. Updating that setup is not a first-class
session operation: the operator can restart a pod, but the system does not model
which setup is in use, what will change, or how to move a durable session from
one setup to another intentionally.

This feature defines an **agent setup** as the versioned profile that controls
the runtime environment for an agent session: runner image tag, command-line
tooling/version selection, MCP/connectors configuration, tool/profile selection,
and tool allowlist. Setups are visible and selectable per session. A
"restart & continue with setup X" action recreates the runner pod with the
chosen setup while the durable session from spec 002 replays history and
continues under the new setup.

The feature is the product-facing payoff for durable restart: the operator can
see the current setup, compare it with an available setup, explicitly restart
into the chosen setup, and get a guarded continuation marker rather than a
silent environment change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and choose a session setup (Priority: P1)

The operator can see which setup a session currently uses, which setup versions
are available, and what would change before selecting a different setup for the
session.

**Why this priority**: Restart-with-updated-setup is unsafe and confusing unless
the current and target runtime environments are visible before the restart.

**Independent Test**: Open a session with a known setup, list available setup
versions, choose a different setup, and verify that the UI/API shows the current
setup, target setup, and field-level diff without restarting the session yet.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the operator views setup details,
   **Then** the system shows the current setup name/version and the material
   runtime fields that affect the runner environment.
2. **Given** multiple available setups, **When** the operator selects a target
   setup, **Then** the system shows a clear diff from the current setup to the
   target setup before any runner restart happens.
3. **Given** the selected setup differs only by version, **When** the diff is
   shown, **Then** the version change is visible even if the setup name is the
   same.

---

### User Story 2 - Restart and continue under a selected setup (Priority: P1)

The operator restarts a durable session with a chosen setup. The existing runner
pod is replaced, history is replayed from durable storage, and new work
continues in the same logical session under the target setup.

**Why this priority**: This is the core capability: adopt a new runner setup
without losing the session or pretending the environment never changed.

**Independent Test**: Produce history in a durable session, choose a newer setup
version, trigger "restart & continue with setup X", and verify that the runner
pod is recreated with the target setup while the session id and replayed history
remain intact.

**Acceptance Scenarios**:

1. **Given** a durable session using setup A, **When** the operator confirms
   restart with setup B, **Then** the runner pod is recreated with setup B and
   the session continues under the same stable session id.
2. **Given** the restart completes, **When** the operator reopens the session,
   **Then** the prior transcript is replayed, followed by a visible delimiter
   showing the setup change from A to B.
3. **Given** the restarted session is ready, **When** the operator sends input,
   **Then** it reaches the freshly-started process running under setup B.

---

### User Story 3 - Guard unsafe setup changes (Priority: P2)

The system validates setup changes before restarting and prevents a running
session from silently changing environment while work is in progress.

**Why this priority**: Setups control credentials, connectors, tools, and image
contents. A bad or silent change can break a session in ways that look like
ordinary runtime failure.

**Independent Test**: Attempt to restart a session with an unavailable setup, a
setup missing required secret bindings, and a concurrent restart request; verify
that each case is rejected or serialized with a clear status and no silent setup
mutation.

**Acceptance Scenarios**:

1. **Given** a running session, **When** a setup catalog default changes,
   **Then** the running session stays on its recorded setup until the operator
   explicitly restarts it.
2. **Given** a target setup with missing required connector/secret bindings,
   **When** the operator requests restart, **Then** the system blocks the
   restart and explains which setup prerequisite is unavailable without
   exposing secret values.
3. **Given** a restart is already in progress, **When** another setup change is
   requested, **Then** the system prevents conflicting runner recreation and
   leaves the session in a recoverable state.

---

### User Story 4 - Manage versioned setup availability (Priority: P3)

Maintainers can publish, retire, and inspect setup versions so session choices
are explicit and reproducible over time.

**Why this priority**: Sessions need stable setup references. A setup that is
edited in place after being used by a session would make restart history and
diffs unreliable.

**Acceptance Scenarios**:

1. **Given** a setup has been used by a session, **When** its runtime definition
   needs to change, **Then** the system represents that change as a new setup
   version rather than mutating the historical version.
2. **Given** an obsolete setup version, **When** it is retired, **Then** existing
   sessions that used it can still show their historical setup, while new
   sessions cannot select it unless explicitly allowed.
3. **Given** a setup version references a runner image tag, **When** image
   release automation publishes a newer tag, **Then** availability of the newer
   setup is explicit and does not automatically alter active sessions.

### Edge Cases

- Target setup is removed or retired after the operator opens the diff but
  before restart confirmation.
- Target setup references a runner image or profile that is unavailable at
  restart time.
- Required MCP/connectors configuration exists, but the session's project or
  operator lacks the corresponding secret binding.
- Restart is requested while the session is actively streaming output or while
  input is being sent.
- The new runner pod fails to become ready after the old pod has been
  terminated.
- A stale UI request attempts to restart from an old session epoch or old setup
  version.
- Setup diff contains secret references; the diff must show binding identity and
  availability without revealing secret values.
- Current setup has been superseded by a newer version while the session keeps
  running.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST model an agent setup as a named, versioned,
  selectable runtime profile for sessions.
- **FR-002**: Each setup version MUST include, at minimum, runner image tag,
  command-line tooling/version selection, MCP/connectors configuration, selected
  tool/profile set, and tool allowlist.
- **FR-003**: Setup versions used by any session MUST remain immutable for
  historical display, replay delimiters, and auditability; changes MUST create a
  new version.
- **FR-004**: Each session MUST record its current setup name/version separately
  from any catalog default so default changes do not silently mutate active or
  historical sessions.
- **FR-005**: The system MUST expose the current setup and available target
  setups for a session through the API consumed by the agents view.
- **FR-006**: The agents view MUST show the current setup, available setups, and
  a clear diff for a selected restart target, including the direction of change
  from setup A to setup B.
- **FR-007**: The system MUST provide a "restart & continue with setup X"
  action that validates the target setup, recreates the runner pod with that
  setup, and keeps the durable session id unchanged.
- **FR-008**: Restarting with a different setup MUST integrate with the durable
  session behavior from spec 002: the session epoch is bumped, clients take a
  clean snapshot, and a delimiter marks the setup transition before live output
  resumes.
- **FR-009**: A setup change for a running session MUST require an explicit
  restart action and confirmation; the system MUST NOT silently replace the
  environment for an in-flight session.
- **FR-010**: Restart validation MUST block target setups that are unavailable,
  retired for new use, missing required secret/connector bindings, or
  incompatible with the session's workspace/project constraints.
- **FR-011**: Restart failure MUST leave the session recoverable: preserved
  history remains attachable, the current/target setup state is visible, and the
  operator can retry or choose another setup.
- **FR-012**: Setup diffs and status messages MUST redact secret values while
  still identifying which binding, connector, or prerequisite is missing.
- **FR-013**: The setup model MUST support a release-driven runner image
  workflow where image tags can be pinned in setup versions and newer released
  tags can be offered as new setup versions without changing active sessions.

### Key Entities *(include if feature involves data)*

- **Agent setup**: Named runtime profile selectable for a session. Defines the
  runner image, command-line tooling/version selection, MCP/connectors
  configuration, tool/profile selection, and tool allowlist.
- **Setup version**: Immutable revision of an agent setup. Used to make session
  history, diffs, and restart events reproducible.
- **Session setup selection**: Per-session record of the current setup
  name/version and any pending target setup selected for restart.
- **Setup diff**: Redacted comparison of current and target setup versions,
  showing material runtime changes before restart confirmation.
- **Setup restart event**: Durable session event recording the requested target
  setup, validation result, epoch bump, and continuation delimiter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every session, the agents view and API can report the current
  setup name/version and whether a newer or alternate setup is selectable.
- **SC-002**: Before restart, the operator can see a field-level diff from the
  current setup to the target setup in 100% of setup-change flows.
- **SC-003**: "Restart & continue with setup X" recreates the runner pod under
  the target setup, preserves the durable session id, replays history, and
  resumes live input/output with a visible setup-transition delimiter.
- **SC-004**: Active sessions are never silently moved to a new setup when a
  catalog default or image tag changes; setup adoption requires an explicit
  restart request.
- **SC-005**: Invalid setup targets are blocked before runner recreation with a
  clear, redacted validation result.
- **SC-006**: Superseded setup versions remain visible on historical sessions
  and restart events, while retired versions are not offered for ordinary new
  selection.

## Assumptions

- Spec 002 provides durable session identity, persisted history replay, epoch
  handling, and restart delimiters for runner recreation.
- Spec 003 exposes the user-facing controls in the agents view; this feature
  defines the setup data and restart contract that view consumes.
- A setup version is pinned by identity and explicit version, not by "latest" or
  a mutable default, once selected for a session.
- Runner image tags used in setups are release artifacts from the agents stack;
  exact release cadence and update automation remain open.

## Open Questions

- [NEEDS CLARIFICATION: setup definition source not specified] Are setup
  versions defined in a repo-managed catalog, editable by operators through the
  product, or both?
- [NEEDS CLARIFICATION: setup ownership scope not specified] Are setups global,
  per user, per project/workspace, or a combination with inheritance?
- [NEEDS CLARIFICATION: secret binding and release update policy not specified]
  How are MCP/connector secrets bound to a setup version, and how should setup
  versions relate to runner image release cadence and Renovate-driven bumps?

## Non-Goals

- Implementing durable transcript persistence, history replay, or epoch
  mechanics themselves; those belong to spec 002.
- Redesigning the agents view layout beyond the setup controls and diff
  contract; the broader UI work belongs to spec 003.
- Defining the runner image release automation or dependency bump policy; this
  feature only consumes released image tags as setup version inputs.
- Migrating a tool's own internal conversation state across setup changes beyond
  the durable transcript replay provided by spec 002.
- Editing or storing raw secret values in setup diffs, restart requests, or
  setup history.
