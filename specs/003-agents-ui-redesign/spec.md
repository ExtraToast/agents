# Feature Specification: Agents-view UI redesign (modern agent console)

**Feature Branch**: `003-agents-ui-redesign`
**Created**: 2026-06-11
**Status**: Draft
**Input**: A complete UI redesign of the agents workspace, focused on the agents
view, including controls to restart the container and continue a session with the
full history attached.

## Overview

The current workspace UI grew around an "assistant" framing and a basic
terminal + sidebar. Now that the product is explicitly about **agents**, the
view should be a focused **agent console**: a clear session list with live
status, a first-class terminal, and obvious controls to manage the agent's
lifecycle — including restarting the runner to adopt an updated setup and
continuing the session with its full history (spec 002).

Stays on the existing stack — Vue 3 + Pinia + PrimeVue + Tailwind +
`@extratoast/vue-web-commons` — so the redesign is a UX/layout overhaul, not a
framework migration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A focused agent console (Priority: P1)

The operator opens the agents view and immediately understands: which sessions
exist, each one's live status (starting / running / idle / stopped), and which is
active. The active session shows a prominent, responsive terminal with the
agent's output, and the layout scales cleanly from a wide desktop to a narrow
window.

**Why this priority**: The core daily surface; clarity and responsiveness here
are the whole point of the redesign.

**Independent Test**: Load the agents view with several sessions of varying
status; the list, status indicators, and active terminal render clearly and
remain usable at desktop and narrow widths.

**Acceptance Scenarios**:

1. **Given** multiple sessions, **When** the view loads, **Then** each session
   shows its title and a live status indicator, the active one is visually
   distinct, and the terminal fills the available space.
2. **Given** a status change elsewhere, **When** it occurs, **Then** the list
   reflects it promptly without a manual refresh.
3. **Given** a narrow viewport, **When** the view renders, **Then** the layout
   adapts (e.g. collapsible session list) without breaking the terminal.

### User Story 2 - Restart-with-history controls (Priority: P1)

From the agents view, the operator can restart the agent runner (to adopt an
updated setup) and continue the session — the terminal repopulates with the full
prior history and a clear marker that the agent was restarted/updated, then
resumes live.

**Why this priority**: This is the new capability the redesign must expose
(pairs with spec 002).

**Independent Test**: With a session that has scrollback, use the restart/continue
control; the terminal shows the full prior history, a restart marker, and a live
prompt against the updated agent.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the operator triggers "restart &
   continue", **Then** the UI confirms intent, shows restart progress, then
   reattaches and replays the full history followed by live output.
2. **Given** the restart in progress, **When** the runner is not yet ready,
   **Then** the UI shows a clear transient state (not a broken/blank terminal)
   and recovers automatically when ready.
3. **Given** the restart completes, **When** history replays, **Then** a visible
   delimiter marks "agent restarted (updated setup)" so old vs new output is
   unambiguous.

### User Story 3 - Smooth, lossless terminal interaction (Priority: P2)

Typing and output feel immediate; reconnecting (tab sleep, network blip, restart)
resumes the terminal without clearing the screen or losing/duplicating output.

**Why this priority**: Responsiveness + losslessness are core to the redesign's
quality bar and tie into the offset/epoch + persistence work.

**Acceptance Scenarios**:

1. **Given** an active terminal, **When** the connection blips and reconnects,
   **Then** the screen is not cleared and only missed output is replayed (no
   dup/loss) — full snapshot only on epoch change.
2. **Given** input, **When** typed, **Then** it echoes with no perceptible lag
   under normal conditions.

### User Story 4 - Session management actions (Priority: P3)

The operator can start, stop, rename, and switch sessions from the console, and
see useful per-session metadata (status, last activity, the agent kind/setup in
use).

**Acceptance Scenarios**:

1. **Given** the console, **When** the operator starts/stops/renames/switches a
   session, **Then** the action is reflected immediately and the controls are
   discoverable.
2. **Given** a session, **When** viewed, **Then** its current agent setup/kind
   and last-activity are shown.

### Edge Cases

- No sessions yet — a clear empty state with a primary "start a session" action.
- A very long transcript — the terminal stays smooth (relies on the terminal's
  own scrollback/virtualization, not Vue re-rendering the whole buffer).
- Restart triggered while disconnected — the control degrades gracefully and
  reconciles when reconnected.
- Accessibility: status conveyed by more than color; keyboard-navigable controls;
  terminal focus management on tab switch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The agents view MUST present a session list with per-session live
  status (starting/running/idle/stopped) and a clearly distinguished active
  session.
- **FR-002**: The active session MUST render a first-class, responsive terminal
  that fills available space and adapts across desktop/narrow widths.
- **FR-003**: Session list and statuses MUST update without manual refresh
  (server-pushed), and the terminal MUST reconnect losslessly (offset/epoch: no
  clear/dup/loss within window; full snapshot on epoch change).
- **FR-004**: The view MUST expose a "restart & continue" control that restarts
  the runner (to adopt an updated setup), shows transient progress, then
  reattaches and replays the full persisted history (spec 002) followed by live
  output.
- **FR-005**: Restart/continuation MUST render a clear delimiter marking the
  restart (updated setup) so pre- and post-restart output are unambiguous.
- **FR-006**: The view MUST support start/stop/rename/switch session actions and
  show per-session metadata (status, last activity, agent setup/kind).
- **FR-007**: The redesign MUST stay on Vue 3 + Pinia + PrimeVue + Tailwind +
  `@extratoast/vue-web-commons` (no framework migration) and respect the shared
  theme (light/dark) and auth/CSRF conventions.
- **FR-008**: The view MUST meet baseline accessibility: status not by color
  alone, keyboard-navigable controls, sensible terminal focus management.
- **FR-009**: An empty state MUST guide the operator to start their first
  session.

### Key Entities *(include if feature involves data)*

- **Session console**: the redesigned agents view composition (list + status +
  terminal + lifecycle controls).
- **Session status**: live lifecycle + idle + current agent setup/kind, surfaced
  per session.
- **Restart/continue action**: UI affordance bound to the runner restart +
  history-replay flow (spec 002).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The agents view renders the session list, live status, and a
  responsive terminal cleanly at both desktop and narrow widths (verified via
  e2e/visual checks).
- **SC-002**: "Restart & continue" reliably restarts the runner and brings back
  the full history with a clear restart delimiter, then live output — no blank or
  broken terminal during the transition.
- **SC-003**: Terminal reconnect shows zero clear/dup/loss within the supported
  window; epoch change yields a clean snapshot.
- **SC-004**: Status updates appear without manual refresh within a few seconds.
- **SC-005**: Baseline accessibility checks pass (non-color status, keyboard nav,
  focus handling).

## Assumptions

- Backend support for live status (server-pushed), lossless reconnect
  (offset/epoch), and durable restart-with-history is provided by the API/gateway
  work (responsiveness Phase 2 + spec 002).
- Design direction: modern agent console on the current stack (confirmed);
  concrete layout/visual details are settled during planning, optionally via
  mockups in the plan.

## Non-Goals

- Switching UI frameworks or component libraries.
- The backend persistence/restart mechanics (spec 002) and the extraction/rename
  (spec 001) — this spec consumes their capabilities at the UI layer.
- Redesigning unrelated app surfaces outside the agents/workspace view.
