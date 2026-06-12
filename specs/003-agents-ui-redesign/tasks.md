# Tasks: 003-agents-ui-redesign

**Input**: Design documents from `/specs/003-agents-ui-redesign/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), spec 002 restart/history backend contracts, `agents-api` session-status SSE contract, published `@extratoast/vue-web-commons` rail release

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks because it touches different files
- **[Story]**: User story label, for example US1, US2, US3
- Include exact file paths in descriptions for this repository; external package tasks are marked as external because that source is not present in this worktree

## Phase 1: Setup

- [ ] T001 [External] Add the opt-in `layout="rail"` AppShell variant in the external `@extratoast/vue-web-commons` package with default `layout="topbar"`, optional nav icons, optional nav children, collapsed/expanded rail, mobile off-canvas drawer, quick New session action, bottom-pinned theme/account controls, and tests for both layouts
- [ ] T002 [External] Publish `@extratoast/vue-web-commons` `0.3.0` to GitHub Packages and verify the package exports the rail prop and extended nav item type
- [ ] T003 Bump `@extratoast/vue-web-commons` in `services/agents-ui/package.json` after T002 and verify install/type resolution
- [ ] T004 Update `services/agents-ui/playwright.config.ts` with explicit desktop and mobile viewport projects for the agents console e2e coverage
- [ ] T005 Identify and document the final validation sequence from [plan.md](./plan.md): `cd services/agents-ui && npm run typecheck && npm run lint && npm run test && npm run test:e2e`, plus `npm run contract:check` when OpenAPI-generated files change

## Phase 2: Foundational

- [ ] T006 Update `services/agents-ui/src/layouts/AppShell.vue` to consume the published rail AppShell, provide icon metadata, add Sessions child sub-items that deep-link to tabs on `/sessions`, and expose the quick New session action without adding routes
- [ ] T007 [P] Extend `services/agents-ui/src/features/workspaces/types/index.ts` with session metadata required by the console: status stream fields, last activity, agent setup/kind display fields, restart progress, epoch, and offset where the backend contract exposes them
- [ ] T008 Add `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` to wrap the `agents-api` session-status SSE stream with `EventSource`, auth-compatible same-origin credentials, reconnect handling, and no polling fallback
- [ ] T009 Add `services/agents-ui/src/features/workspaces/stores/sessionStatuses.ts` to own live status state, merge the REST snapshot with SSE updates, expose accessible status labels, and cleanly disconnect on workspace changes
- [ ] T010 Update `services/agents-ui/src/features/workspaces/services/workspaceService.ts` to use generated backend operations for restart-and-continue and any spec 002 offset/epoch fields once those contracts exist; run `services/agents-ui` contract generation only when OpenAPI has changed
- [ ] T011 [P] Add Vitest coverage for `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` and `services/agents-ui/src/features/workspaces/stores/sessionStatuses.ts`, including reconnect, update merge, and teardown behavior

## Phase 3: User Story 1 - Focused Console And Live Status (Priority: P1)

**Goal**: The operator can open the agents view, see a responsive console, identify live session status, and switch the active session without a manual refresh.

**Independent Test**: Load `/sessions` and a workspace detail with multiple sessions; verify Workspace is the default tab, the workspace console renders session list, hero terminal, status rail, and live status chips at desktop and mobile widths.

- [ ] T012 [US1] Update `services/agents-ui/src/features/sessions/views/SessionsView.vue` so Workspace is the first/default tab and the sessions home is left-aligned by removing the centered `mx-auto` layout
- [ ] T013 [US1] Update `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` into the responsive console shell with collapsible session list, hero terminal region, status rail grid, empty state, and desktop-to-narrow layout behavior
- [ ] T014 [P] [US1] Add `services/agents-ui/src/features/workspaces/components/SessionStatusChip.vue` for non-color-only status indicators, accessible labels, and stable sizing
- [ ] T015 [P] [US1] Add `services/agents-ui/src/features/workspaces/components/SessionStatusRail.vue` for live status, last activity, agent setup/kind, connection state, and restart progress metadata
- [ ] T016 [US1] Wire `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` to `services/agents-ui/src/features/workspaces/stores/sessionStatuses.ts` so status updates are server-pushed and reflected promptly without polling
- [ ] T017 [P] [US1] Add Vitest coverage in `services/agents-ui/src/features/sessions/__tests__/SessionsView.test.ts` for Workspace-first/default tab order and left-aligned layout
- [ ] T018 [P] [US1] Update `services/agents-ui/src/features/workspaces/__tests__/WorkspaceView.test.ts` for console composition, empty state, collapsible list behavior, and status rail rendering
- [ ] T019 [US1] Add Playwright coverage in `services/agents-ui/e2e/agent-console.spec.ts` for desktop and mobile console layout, status chip text/icon semantics, and no manual refresh for status updates

## Phase 4: User Story 2 - Restart And Continue (Priority: P1)

**Goal**: The operator can restart a session to adopt an updated setup, see progress, reattach, replay persisted history with a restart delimiter, and continue live.

**Independent Test**: With a session that has scrollback, trigger restart-and-continue; verify confirm, progress, reattach, full history replay, visible `agent restarted (updated setup)` delimiter, and live output continuation.

- [ ] T020 [US2] Add restart-and-continue store state and actions in `services/agents-ui/src/features/workspaces/stores/workspaces.ts`, including confirm pending, in-progress, reattaching, replaying history, live, and failed states
- [ ] T021 [US2] Add the restart-and-continue control in `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` with confirmation, disabled/transient states, status rail integration, and recovery when disconnected
- [ ] T022 [US2] Update `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` to render or inject the `agent restarted (updated setup)` delimiter only on the spec 002 restart/epoch transition path
- [ ] T023 [P] [US2] Add Vitest coverage in `services/agents-ui/src/features/workspaces/__tests__/workspaces.store.test.ts` for restart state transitions, failure recovery, and active-session preservation
- [ ] T024 [P] [US2] Add Vitest coverage in `services/agents-ui/src/features/workspaces/__tests__/WorkspaceView.test.ts` for confirm, progress, delimiter visibility, and reattach UI states
- [ ] T025 [US2] Extend `services/agents-ui/e2e/agent-console.spec.ts` with a restart-and-continue flow that verifies persisted history replay before live output

## Phase 5: User Story 3 - Lossless Terminal And Copy Repair (Priority: P2)

**Goal**: Terminal reconnect is lossless, terminal buffers are not re-rendered by Vue, and chat/terminal content can be selected and copied predictably.

**Independent Test**: Simulate a reconnect with the same epoch and missed offsets, then an epoch change; verify no reset on same epoch, reset/snapshot only on epoch change, no duplicated output, selectable text, and working Copy controls.

- [ ] T026 [US3] Update `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` for spec 002 offset/epoch reconnect frames, missed-output replay, heartbeat preservation, and no `onReopen` reset except on epoch change
- [ ] T027 [US3] Update `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` to keep one xterm instance per live session, avoid Vue rendering of terminal buffers, tune xterm options, enable copy-on-select, enable `rightClickSelectsWord`, and add `attachCustomKeyEventHandler` Ctrl/Cmd+C behavior
- [ ] T028 [US3] Add a terminal Copy button in `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` that copies the current xterm selection or visible buffer content according to xterm APIs
- [ ] T029 [P] [US3] Update `services/agents-ui/src/features/sessions/components/ChatTab.vue` so message content is selectable and each message exposes a Copy control with streaming/failed states handled cleanly
- [ ] T030 [P] [US3] Add or update Vitest coverage in `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts` for offset/epoch replay, same-epoch reconnect without reset, epoch-change snapshot behavior, and queued input preservation
- [ ] T031 [P] [US3] Add or update Vitest coverage in `services/agents-ui/src/features/workspaces/__tests__/SessionTerminal.test.ts` for copy-on-select options, custom Ctrl/Cmd+C handling, terminal Copy button, and buffer preservation across active tab switches
- [ ] T032 [P] [US3] Add Vitest coverage in `services/agents-ui/src/features/sessions/__tests__/ChatTab.copy.test.ts` for per-message Copy controls and selectable message text
- [ ] T033 [US3] Extend `services/agents-ui/e2e/agent-console.spec.ts` with reconnect and copy scenarios covering terminal selection, chat message copy, and no blank terminal during same-epoch reconnect

## Phase 6: User Story 4 - Session Actions And Mobile Controls (Priority: P3)

**Goal**: The operator can start, stop, rename, and switch sessions with useful metadata, and mobile terminal controls remain tap-reachable.

**Independent Test**: On desktop and a mobile viewport, start a session, switch tabs, rename it, stop it from inside the tab, and use the touch bar to send Esc, Ctrl-C, arrows, Tab, keyboard focus, and paste.

- [ ] T034 [US4] Update `services/agents-ui/src/features/workspaces/components/SessionTabs.vue` so each tab shell is a `div role="tab" tabindex="0"` with click and keyboard selection handlers, and the stop/close action is inside the tab on the right using `@click.stop`
- [ ] T035 [US4] Update `services/agents-ui/src/features/workspaces/components/SessionTabs.vue` to show per-session metadata: status, last activity, agent setup/kind, rename affordance, and active state without relying on color alone
- [ ] T036 [US4] Update `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` and `services/agents-ui/src/features/workspaces/stores/workspaces.ts` so start, stop, rename, and switch actions update immediately and reconcile with server-pushed status
- [ ] T037 [US4] Update `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` with a `pointer: coarse` touch bar wired to existing `socket.sendKey` behavior for Esc, Ctrl-C, arrows, Tab, Keyboard focus, and Paste
- [ ] T038 [US4] Update `services/agents-ui/src/App.vue`, `services/agents-ui/src/index.css`, and `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` with `100dvh`/`svh`, `env(safe-area-*)`, and `min-h-10` touch-target sizing so mobile keyboard and safe areas do not hide controls
- [ ] T039 [P] [US4] Update `services/agents-ui/src/features/workspaces/__tests__/SessionTabs.test.ts` for `div role="tab"` keyboard selection, nested stop control with `@click.stop`, inline rename, and metadata rendering
- [ ] T040 [P] [US4] Update `services/agents-ui/src/features/workspaces/__tests__/SessionTerminal.test.ts` for touch bar key dispatch, paste behavior, keyboard-focus button, and mobile-only visibility
- [ ] T041 [US4] Extend `services/agents-ui/e2e/agent-console.spec.ts` with mobile viewport coverage for rename, stop, tab switch, safe-area sizing, and touch bar key dispatch

## Phase 7: Polish

- [ ] T042 Run `cd services/agents-ui && npm run typecheck`
- [ ] T043 Run `cd services/agents-ui && npm run lint`
- [ ] T044 Run `cd services/agents-ui && npm run test`
- [ ] T045 Run `cd services/agents-ui && npm run test:e2e`
- [ ] T046 Run `cd services/agents-ui && npm run contract:check` if any generated API types or OpenAPI contracts changed
- [ ] T047 Review `services/agents-ui/src/layouts/AppShell.vue`, `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue`, and `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue` for keyboard navigation, non-color status, focus handoff on tab switch, and mobile touch-target regressions

## Dependencies

- T001 and T002 are external gates; T003 cannot start until the shared package is published.
- T006 depends on T003.
- T008, T009, and T016 depend on the `agents-api` session-status SSE contract.
- T010, T020, T021, T022, and T025 depend on the spec 002 restart-and-continue contract.
- T026 through T031 depend on the spec 002 offset/epoch terminal attach contract.
- Phase 2 foundational work should land before user-story implementation.
- US1 is the first UI integration slice and should land before US2 through US4.
- US2 and US3 can proceed in parallel after their backend contracts exist because restart state and socket reconnect touch different primary files, but they must be reconciled in `SessionTerminal.vue`.
- US4 can proceed after the US1 console shell exists.
- Polish runs after the selected story slices are complete.

## Parallel Example

```text
T014 [P] [US1] Add SessionStatusChip.vue
T015 [P] [US1] Add SessionStatusRail.vue
T017 [P] [US1] Add SessionsView Vitest coverage
T018 [P] [US1] Update WorkspaceView Vitest coverage
```

```text
T029 [P] [US3] Add ChatTab Copy controls
T030 [P] [US3] Update sessionSocket tests
T031 [P] [US3] Update SessionTerminal tests
T032 [P] [US3] Add ChatTab copy tests
```
