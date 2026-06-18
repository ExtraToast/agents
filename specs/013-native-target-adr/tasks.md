# Tasks: Native Target ADR

**Input**: ADR specification from `/specs/013-native-target-adr/spec.md`
**Prerequisites**: `specs/012-mobile-usability/spec.md`, verified agents-ui source anchors

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel because it touches different files or only reads source context
- Tasks in this file describe ADR completion and handoff only; implementation work belongs to dependent specs.

## Phase 1: Evidence

- [x] T001 [P] Verify agents-ui dependency anchors in `services/agents-ui/package.json`
- [x] T002 [P] Verify xterm/WebGL terminal behavior in `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue`
- [x] T003 [P] Verify chat streaming transport in `services/agents-ui/src/features/sessions/services/chatSessionsService.ts`
- [x] T004 [P] Verify SSE transport in `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts`
- [x] T005 [P] Verify WS attach transport in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [x] T006 [P] Verify auth/router assumptions in `services/agents-ui/src/lib/vueWebCommons.ts` and `services/agents-ui/src/router/index.ts`
- [x] T007 [P] Verify prior mobile usability baseline in `specs/012-mobile-usability/spec.md`

## Phase 2: ADR Authoring

- [x] T008 Author native target decision matrix in `specs/013-native-target-adr/spec.md`
- [x] T009 Record rejection rationale for NativeScript-Vue, Ionic Vue as target shell, and Tauri 2 Mobile in `specs/013-native-target-adr/spec.md`
- [x] T010 Record reuse sub-decision in `specs/013-native-target-adr/spec.md`
- [x] T011 Record browser transport and CORS decision in `specs/013-native-target-adr/spec.md`
- [x] T012 Record REST-minted WS attach-token decision in `specs/013-native-target-adr/spec.md`
- [x] T013 Record dependencies and downstream handoff boundaries in `specs/013-native-target-adr/spec.md`

## Phase 3: Spec Kit Files

- [x] T014 Create implementation plan in `specs/013-native-target-adr/plan.md`
- [x] T015 Create ADR task checklist in `specs/013-native-target-adr/tasks.md`
- [x] T016 Run ADR file existence and keyword verification command from `specs/013-native-target-adr/plan.md`

## Dependencies

- `specs/012-mobile-usability/spec.md` precedes this ADR as mobile UX prior art.
- Backend CORS and attach-token implementation depend on this ADR but are owned by backend-gap specs.
- Native scaffold placement depends on this ADR's default reuse decision.
- Native networking/origin work depends on this ADR's browser transport decision.
- Auth/account/admin/signup grafting depends on verified route tables and contracts; auth-ui source paths are not present in this checkout.

## Downstream Handoff

- Scaffold work should add Capacitor 7 to `services/agents-ui` by default and avoid creating `services/accounts-agents-app` unless extraction lands first as its own milestone.
- Networking work should replace same-origin URL assumptions with runtime origins while preserving browser `fetch`, `EventSource`, and `WebSocket`.
- Backend work should implement explicit CORS allow-list entries for `capacitor://localhost` and `http://localhost`.
- Backend WS work should require short-lived single-use replay-protected attach-tokens obtained via authenticated REST.
- Design work should inherit `specs/012-mobile-usability/spec.md` and treat Ionic Vue only as optional isolated gesture/control grafting.

## Parallel Example

```text
T001 [P] Verify agents-ui dependency anchors in services/agents-ui/package.json
T003 [P] Verify chat streaming transport in services/agents-ui/src/features/sessions/services/chatSessionsService.ts
T004 [P] Verify SSE transport in services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts
```
