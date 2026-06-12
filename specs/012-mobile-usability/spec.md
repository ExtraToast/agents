# Feature Specification: Mobile usability for the agents UI

**Feature Branch**: `012-mobile-usability`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Make the agents web UI genuinely usable on phones and small touch
screens — as many mobile adaptations as possible — building on the rail shell
(003), durable-session console (002/003), and setup management (010).

## Overview

The agents UI was designed desktop-first. The rail shell, session console,
terminal, sessions home, repository wizard, and setup picker assume a wide
viewport, hover affordances, fine-pointer targets, and a keyboard that does not
overlap content. On a phone this is awkward: the console's multi-column grid
overflows, controls are below the 44px touch minimum, some actions are
hover-only, the on-screen keyboard pushes the terminal input off-screen, and
notch/home-indicator safe areas are ignored.

This feature makes the UI mobile-first-capable: a responsive shell, a
single-column console with collapsible panels, comprehensive touch targets,
tap equivalents for every hover/right-click/double-click affordance, dynamic
viewport units so the keyboard never hides the input, safe-area insets, and
touch-friendly terminal, tabs, sessions, wizard, and setup controls. It must not
regress desktop usage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate the whole app one-handed on a phone (P1)

A user on a phone can reach every destination (Sessions tabs, Repositories,
account, theme) and start a new session without a mouse, hover, or off-screen
control.

**Why this priority**: navigation is the entry point; if the shell is unusable
on mobile nothing else matters.

**Independent Test**: At a 390×844 viewport, open the app, expand/collapse the
navigation, deep-link to each Sessions tab, trigger "New session", toggle theme,
and open the account menu — all via tap, with no element under 44px and no
horizontal scroll.

### User Story 2 - Drive a live terminal session on a phone (P1)

A user can attach to a running session, read scrollback, send keys (Esc, Ctrl-C,
arrows, Tab), paste, copy a selection, and type a prompt while the on-screen
keyboard is open — without the input being hidden or the layout breaking.

**Why this priority**: the terminal is the core of a workspace session.

**Independent Test**: At a coarse-pointer mobile viewport, attach to a session,
open the keyboard, confirm the input/touch-bar stays visible above it (dynamic
viewport units), use every touch-bar key, copy selected text, and paste.

### User Story 3 - Manage sessions and restart-into-setup on a phone (P2)

A user can switch between session tabs, rename and stop a session, see status,
and run restart-&-continue with the setup picker + A→B diff, all in a
single-column touch layout.

**Why this priority**: session + setup management (002/003/010) must be reachable
on mobile, not just desktop.

**Independent Test**: At a mobile viewport, scroll the vertical session tab list,
rename a session via the always-visible edit control, stop it, open the
lifecycle/setup panel (collapsible), pick a target setup, and read the diff.

### User Story 4 - Complete repository/workspace flows on a phone (P3)

A user can create a workspace, attach a repository, and complete the wizard with
full-width, touch-sized inputs and no clipped content.

**Independent Test**: At a mobile viewport, run the create-workspace wizard and
repository attach end to end via tap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shell (vue-web-commons rail variant + agents-ui AppShell) MUST
  present a mobile navigation pattern under the `lg` breakpoint: a left-anchored
  Teleport drawer (or bottom-anchored sheet) toggled by a touch-sized control
  that takes no vertical space when collapsed; nav rows, New action, theme, and
  account are all reachable by tap.
- **FR-002**: Every interactive control (buttons, tabs, icon buttons, inputs,
  menu items, touch-bar keys) MUST have a touch target ≥ 44×44 CSS px on
  coarse-pointer viewports.
- **FR-003**: No view may produce horizontal overflow at 360px width; long text
  truncates or wraps, and grids collapse to a single column.
- **FR-004**: The workspace console MUST collapse its multi-column grid to a
  single column under `lg`, with the session list, terminal, and
  lifecycle/setup/status panels as independently collapsible sections so the
  terminal can use the full width.
- **FR-005**: Every hover-only, right-click, or double-click affordance MUST have
  an explicit tap equivalent (e.g. always-visible edit/stop controls, an actions
  menu/sheet) so nothing is reachable only via pointer gestures.
- **FR-006**: Viewport height MUST use dynamic/small viewport units (`svh`/`dvh`)
  and `env(safe-area-inset-*)` padding so the on-screen keyboard never hides the
  terminal input or footer, and notch/home-indicator areas are respected.
- **FR-007**: The terminal MUST be fully operable by touch: the existing
  `pointer:coarse` touch bar (Esc/Ctrl-C/arrows/Tab/Focus/Paste), copy-on-select
  + a Copy button, a comfortable default font size, and tap-to-focus that opens
  the keyboard.
- **FR-008**: Session tabs MUST be a touch-scrollable list with always-visible
  rename and stop controls (no reliance on hover/right-click/double-click), and
  the close (×) inside the tab.
- **FR-009**: The setup picker + A→B diff (010) and status chips (003) MUST be
  legible and operable at mobile widths (stacked rows, wrapped labels, ≥44px
  radio/label hit areas).
- **FR-010**: Forms and wizards (create workspace, attach repository) MUST use
  full-width, touch-sized inputs and controls at mobile widths.
- **FR-011**: The UI MUST respect `prefers-reduced-motion` for any added
  transitions, and remain usable in both portrait and landscape.
- **FR-012**: Changes MUST be additive and MUST NOT regress desktop layout or
  behavior; the topbar/desktop rail paths stay intact.

### Key Entities

- **Responsive shell**: rail (desktop) ↔ drawer/sheet (mobile) with shared nav
  model; lives partly in `@extratoast/vue-web-commons` (publish-gated) and partly
  in `agents-ui/src/layouts/AppShell.vue`.
- **Console layout**: `WorkspaceView.vue` grid → single column + collapsible
  panels under `lg`.
- **Touch primitives**: min-target sizing, touch bar, tap-equivalent action
  controls, safe-area + dynamic-viewport utilities.

## Success Criteria *(mandatory)*

- **SC-001**: At 360–430px widths, every P1/P2 user story completes by tap with
  no element < 44px and no horizontal scroll.
- **SC-002**: With the on-screen keyboard open, the terminal input and touch bar
  remain visible (verified via `svh/dvh` + safe-area handling).
- **SC-003**: Playwright mobile-project (e.g. iPhone 13 / Pixel 5) e2e asserts:
  drawer open/close, Sessions tab deep-links, terminal touch bar under
  `pointer:coarse`, session rename/stop by tap, setup picker selection.
- **SC-004**: Desktop Playwright + unit suites stay green (no regression).
- **SC-005**: `pnpm typecheck && pnpm lint && pnpm test` pass in `agents-ui`.

## Assumptions & Dependencies

- Builds on the merged rail shell (003), durable console (002/003), and setup
  management (010). The mobile drawer/bottom-sheet shell change ships as an
  additive variant in `@extratoast/vue-web-commons` (publish a new minor, then
  bump the pin in `agents-ui`), mirroring the 0.3.0 rail rollout.
- `agents-ui` Vitest/typecheck/lint/Playwright run locally; backend unaffected.

## Out of Scope

- Native apps; offline/PWA; push notifications.
- Backend/API changes (this is a UI-only feature).
