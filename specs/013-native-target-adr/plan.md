# Implementation Plan: Native Target ADR

**Branch**: `013-native-target-adr` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-native-target-adr/spec.md`

## Summary

Record the native-target ADR for the accounts + agents mobile app: Capacitor 7 is the accepted target, `services/agents-ui` is the default reuse base, auth-ui flows are grafted into that app, browser transports remain the transport baseline, and WS attach moves to REST-minted single-use attach-tokens.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x, Kotlin backend contracts referenced only
**Primary Dependencies**: Capacitor 7, Vue, PrimeVue 4, Tailwind 4, xterm 6.0.0, `@xterm/addon-webgl`
**Storage**: N/A for ADR; downstream auth/native specs decide secure token storage
**Testing**: Documentation verification plus downstream Vitest, Playwright, backend integration, native smoke, and contract gates
**Target Platform**: Android and iOS through Capacitor WebView; existing web build preserved
**Project Type**: Mixed UI/native shell/backend contract program
**Performance Goals**: Preserve terminal responsiveness from xterm WebGL renderer and browser streaming behavior
**Constraints**: Keep existing agents-ui DOM parity, avoid native HTTP for app transports, avoid wildcard CORS, do not fork agents-ui feature behavior
**Scale/Scope**: One ADR feeding scaffold, backend gaps, auth, networking, contracts, design, release, and rollout specs

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Claude/Codex parity is not changed by this documentation-only ADR
- [x] Rendered artifacts are not applicable
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification command is identified for touched area

## Project Structure

### Documentation

```text
specs/013-native-target-adr/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Source Code

```text
services/agents-ui/package.json
services/agents-ui/src/lib/vueWebCommons.ts
services/agents-ui/src/router/index.ts
services/agents-ui/src/features/sessions/services/chatSessionsService.ts
services/agents-ui/src/features/workspaces/components/SessionTerminal.vue
services/agents-ui/src/features/workspaces/services/sessionSocket.ts
services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts
specs/012-mobile-usability/spec.md
```

**Structure Decision**: This ADR creates only the three files under `specs/013-native-target-adr/`. It references the verified source paths above but does not edit source code, CI, or any other spec directory.

## Phase 0: Evidence

Verified evidence used by the ADR:

1. `services/agents-ui/package.json` contains xterm 6.0.0, `@xterm/addon-webgl`, PrimeVue 4, and Tailwind 4.
2. `SessionTerminal.vue` instantiates xterm, loads the WebGL addon, and relies on DOM/browser APIs.
3. `chatSessionsService.ts` uses browser `fetch` and `ReadableStream.getReader()` for chat streaming.
4. `sessionStatusStream.ts` uses browser `EventSource` with credentials.
5. `sessionSocket.ts` uses browser `WebSocket` and current same-origin host derivation.
6. `vueWebCommons.ts` and `router/index.ts` show current cookie/CSRF auth and auth-ui redirect integration.
7. `specs/012-mobile-usability/spec.md` defines the mobile UX baseline inherited by the native app.

**Output**: Evidence is embedded directly in [spec.md](./spec.md).

## Phase 1: ADR Content

The ADR records:

1. Decision matrix for Capacitor 7, NativeScript-Vue, Ionic Vue, and Tauri 2 Mobile.
2. Rejection rationale grounded in verified parity items.
3. Reuse sub-decision: Capacitorize `agents-ui` in place by default.
4. Deferred alternative: extract shared packages first only as its own milestone.
5. Transport decision to keep browser `fetch`, `EventSource`, and `WebSocket` with explicit CORS origins.
6. Transport decision to require short-lived single-use replay-protected WS attach-tokens minted by authenticated REST.
7. Dependencies that downstream specs must satisfy.

**Output**: [spec.md](./spec.md)

## Phase 2: Task Planning Approach

[tasks.md](./tasks.md) is limited to the ADR/documentation work and downstream handoff checks. Implementation tasks are intentionally delegated to the dependent specs for backend gaps, scaffold, auth-client capability, native networking, API contracts, release, native auth, design system, and rollout.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Evidence complete
- [x] Phase 1: ADR content complete
- [x] Phase 2: Task planning approach complete

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved

## Verification

```bash
test -f specs/013-native-target-adr/spec.md \
  && test -f specs/013-native-target-adr/plan.md \
  && test -f specs/013-native-target-adr/tasks.md \
  && grep -qi capacitor specs/013-native-target-adr/spec.md \
  && grep -qi nativescript specs/013-native-target-adr/spec.md \
  && grep -qi attach-token specs/013-native-target-adr/spec.md
```
