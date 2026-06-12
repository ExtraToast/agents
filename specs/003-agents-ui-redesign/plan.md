# Implementation Plan: 003-agents-ui-redesign

**Branch**: `003-agents-ui-redesign` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-agents-ui-redesign/spec.md`

## Summary

Redesign the agents workspace into a focused console on the existing Vue 3 stack. The implementation keeps `services/agents-ui` on Vue 3 + Pinia + PrimeVue + Tailwind + `@extratoast/vue-web-commons`, adds a shared AppShell rail variant before consumption, then composes a responsive session list, hero terminal, status rail, restart-and-continue control, lossless terminal reconnect, copy affordances, and mobile terminal controls around the spec 002 restart/history protocol.

The AppShell rail is a sequenced cross-repo dependency. The shared `@extratoast/vue-web-commons` package currently provides the top-bar shell consumed through `services/agents-ui/src/layouts/AppShell.vue`; it must first ship a backward-compatible `layout="rail"` variant, publish a new package version to GitHub Packages, and only then can `services/agents-ui/package.json` bump from the current `0.1.1` pin.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Vue 3.5.35, Vite 8.0.14
**Primary Dependencies**: Pinia 3.0.4, PrimeVue 4.5.5, Tailwind 4.3.0, `@extratoast/vue-web-commons` 0.1.1 today and planned 0.3.0, `@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0
**Storage**: Browser `localStorage` for local active-session and rename preferences; server-owned session, status, transcript, offset, and epoch state through `agents-api`
**Testing**: Vitest for stores/services/components; Playwright for desktop and mobile viewport console flows; `npm run contract:check` when OpenAPI-generated types change
**Target Platform**: Browser UI served by `services/agents-ui`, backed by `agents-api` and runner gateway streams
**Project Type**: UI with cross-repo shared component dependency and backend-contract integration
**Performance Goals**: Server-pushed status visible within a few seconds; terminal reconnect has no clear/dup/loss inside the supported offset window; Vue never re-renders terminal buffer content; mobile terminal controls keep input reachable when the software keyboard is open
**Constraints**: No framework migration; shared auth/theme/CSRF conventions remain through `services/agents-ui/src/lib/vueWebCommons.ts`; no status polling; AppShell default remains top bar for other consumers; rail work must publish before `agents-ui` consumes it
**Scale/Scope**: Agents home, workspace console, session tabs, terminal stream, copy UX, mobile terminal controls, and focused tests in `services/agents-ui`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Agent-surface parity is preserved for any agent-facing behavior
- [x] Rendered artifacts are updated by the owning renderer when source changes require it
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification command is identified for each touched area

## Project Structure

### Documentation

```text
specs/003-agents-ui-redesign/
|-- spec.md
|-- plan.md
`-- tasks.md
```

No separate `research.md`, `data-model.md`, `quickstart.md`, or `contracts/` file is produced in this worker scope. The implementation tasks below call out the API and shared-package contracts that must land before UI consumption.

### Source Code

```text
services/agents-ui/
|-- package.json
|-- playwright.config.ts
|-- e2e/
|   |-- chat.spec.ts
|   `-- agent-console.spec.ts              # new
`-- src/
    |-- App.vue
    |-- layouts/AppShell.vue
    |-- lib/vueWebCommons.ts
    |-- router/index.ts
    |-- features/sessions/
    |   |-- views/SessionsView.vue
    |   |-- components/ChatTab.vue
    |   |-- components/ScratchTab.vue
    |   |-- components/WorkspaceTab.vue
    |   `-- __tests__/
    `-- features/workspaces/
        |-- views/WorkspaceView.vue
        |-- components/SessionTabs.vue
        |-- components/SessionTerminal.vue
        |-- components/SessionStatusChip.vue       # new
        |-- components/SessionStatusRail.vue       # new
        |-- services/sessionSocket.ts
        |-- services/sessionStatusStream.ts        # new
        |-- services/workspaceService.ts
        |-- stores/sessionStatuses.ts              # new
        |-- stores/workspaces.ts
        |-- types/index.ts
        `-- __tests__/
```

**Structure Decision**: Keep the redesign inside existing `sessions` and `workspaces` feature folders. The sessions home remains at `/sessions`, workspace detail remains at `/sessions/workspace/:id`, and AppShell session sub-items deep-link to tabs on `/sessions` rather than introducing new routes. Shared AppShell rail source is outside this repository and must be handled as a package release dependency, not as an in-repo edit.

## Phase 0: Outline & Research

1. Existing spec and code establish that `services/agents-ui` already uses Vue 3, Pinia, PrimeVue, Tailwind, `@extratoast/vue-web-commons`, and xterm.
2. `services/agents-ui/src/layouts/AppShell.vue` wraps the shared `AppShell` with top-level nav items and no icons or child items today.
3. `services/agents-ui/package.json` pins `@extratoast/vue-web-commons` to `0.1.1`; the rail variant must land in the external package and be published before the UI can pass `layout="rail"`.
4. `services/agents-ui/src/features/sessions/views/SessionsView.vue` defaults to the chat tab and centers content with `max-w-6xl mx-auto`; the redesign requires Workspace first/default and left-aligned content.
5. `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` already keeps one `SessionTerminal` per live session mounted with `v-show`, which is the correct foundation for preserving xterm buffers across tab switches.
6. `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` currently resets xterm on reconnect after receiving a fresh attach snapshot. Spec 002 changes this to offset/epoch reconnect: no clear unless epoch changes.
7. The generated OpenAPI and `AgentSessionController` currently expose start, stop, input, staged input, and turns endpoints. The session-status SSE stream and restart-and-continue operation are backend dependencies that must be consumed only after their contracts land.

**Output**: Research findings are captured in this plan.

## Phase 1: Design & Contracts

### Shared AppShell Rail Variant

- Add `layout?: 'topbar' | 'rail'` to the shared `AppShell`, defaulting to `topbar`.
- For `layout="rail"`, render a left vertical rail with a slim collapsed state and expanded icons-plus-labels state.
- Put the hamburger at the rail top; collapsed mode must not reserve vertical label space.
- Extend nav items with optional `icon` and `children` data. Child items are used for Sessions sub-items and deep-link to `/sessions` tab state, not new routes.
- Include a quick New session action in the rail.
- Pin theme toggle and account controls to the rail bottom.
- On `<lg` viewports, collapse the rail into a left off-canvas drawer.
- Expose layout width so the app `<main>` can switch margins between collapsed, expanded, and mobile drawer states.
- Publish the shared package to GitHub Packages, then bump `services/agents-ui/package.json`.

### Console Composition

- Update `services/agents-ui/src/layouts/AppShell.vue` to consume `layout="rail"` after the package bump and provide icon/child nav metadata.
- Rework `services/agents-ui/src/features/sessions/views/SessionsView.vue` so the Workspace tab is first/default and the sessions home is left-aligned.
- Rework `services/agents-ui/src/features/workspaces/views/WorkspaceView.vue` into a console layout:
  - collapsible session list for switching, metadata, and empty state
  - hero xterm region for the active session
  - status rail grid for live status, last activity, agent setup/kind, connection state, and restart progress
  - responsive desktop-to-narrow behavior without breaking terminal sizing

### Status Integration

- Add a Pinia-backed session-status store that subscribes to the `agents-api` session-status SSE stream with `EventSource`.
- Keep status server-pushed; do not add polling.
- Merge status stream updates into session list/status chips while retaining REST-loaded workspace/session details as the initial snapshot.
- Convey status by text/icon/shape as well as color.
- Tear down the SSE connection on workspace exit and reconnect safely on workspace changes.

### Terminal, Copy, And Mobile Interaction

- Keep terminal output in xterm and avoid rendering raw terminal buffers through Vue.
- Wire `sessionSocket.ts` to spec 002 offset/epoch reconnect: replay missed output by offset, only clear/reset on epoch changes, and preserve active xterm buffers across tab switches.
- Tune xterm for the console: stable fit behavior, large scrollback, copy-on-select, `rightClickSelectsWord`, and `attachCustomKeyEventHandler` so Ctrl/Cmd+C copies a selection when present and otherwise passes through to interrupt the running process.
- Add per-message Copy controls in chat content and a terminal Copy control; ensure chat/terminal text regions allow selection.
- Add `pointer: coarse` terminal touch bar controls that use the existing `socket.sendKey` path for Esc, Ctrl-C, arrows, Tab, Keyboard focus, and Paste.
- Use `100dvh`/`svh` and `env(safe-area-*)` sizing so mobile keyboard and safe areas do not push terminal input off-screen.

### Restart And Continue

- Consume the spec 002 restart-and-continue API once available.
- Expose a confirm step, transient progress state, reattach behavior, full persisted-history replay, a visible `agent restarted (updated setup)` delimiter, then live stream continuation.
- Treat restart while disconnected as a recoverable state that reconciles when the status stream and terminal attach recover.

### Accessibility

- Session tabs must be keyboard navigable, expose `role="tab"` and `aria-selected`, and keep stop/close controls reachable without nested buttons.
- Status chips must include accessible labels and non-color indicators.
- Terminal focus must move predictably when switching sessions and must not trap keyboard access to surrounding controls.
- Touch targets should be at least `min-h-10`.

**Output**: Design and contract dependencies are captured in this plan.

## Phase 2: Task Planning Approach

Tasks are ordered by dependency and user story:

1. External shared AppShell rail work and package publish.
2. `agents-ui` package bump and shell consumption.
3. Foundational status/restart/terminal contracts and shared stores/services.
4. US1 console + live status.
5. US2 restart-and-continue.
6. US3 lossless terminal + copy.
7. US4 session actions + mobile terminal controls.
8. Vitest and Playwright verification, including desktop and mobile viewports.

Each task should be independently testable and scoped to a small set of files. Backend-dependent UI tasks should be blocked until the corresponding `agents-api` SSE, restart, and offset/epoch contracts are present.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Shared AppShell rail publish gate | `agents-ui` cannot consume `layout="rail"` until the external package ships and the package pin is bumped | Sequence shared-package work first, keep topbar default, and verify the published types before UI integration |
| App UI parity across consumers | A shared AppShell change can regress other apps | Default `layout` to `topbar`, cover both variants in the shared package tests, and keep rail-specific behavior opt-in |
| Backend contract timing | Status SSE, restart-and-continue, and offset/epoch attach may not exist when UI work starts | Keep UI tasks behind explicit contract gates and use generated API/types after backend contracts land |
| Mobile viewport behavior | Terminal input can be obscured by the software keyboard or safe areas | Use dynamic viewport units, safe-area padding, Playwright mobile viewport checks, and `pointer: coarse` controls |
| Terminal buffer lifecycle | Re-rendering or resetting xterm can lose visible history | Keep one xterm instance per live session mounted and reset only on epoch change |

## Complexity Tracking

No constitution violations are required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete
- [x] Phase 1: Design complete
- [x] Phase 2: Task planning approach complete

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved

**Validation Commands**:

- Shared package: run the external `@extratoast/vue-web-commons` typecheck, lint, unit tests, and package build before publishing.
- Agents UI: `cd services/agents-ui && npm run typecheck && npm run lint && npm run test`
- Agents UI e2e: `cd services/agents-ui && npm run test:e2e`
- API contract, when OpenAPI changes are present: `cd services/agents-ui && npm run contract:check`
