# Implementation Plan: 002-session-persistence-restart

**Branch**: `002-session-persistence-restart` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-session-persistence-restart/spec.md`

## Summary

Durable agent sessions persist terminal output by stable session id, survive
runner pod restarts, and reattach using the additive epoch/offset websocket
contract. The gateway owns the byte-addressable transcript on the workspace PVC
and exposes snapshot-or-resume attach semantics. The API owns pod-independent
session metadata and restart/continue orchestration. The UI keeps reconnect
state and clears only when the gateway declares a snapshot.

## Technical Context

**Language/Version**: Kotlin/Spring Boot services via Gradle conventions; TypeScript 6 + Vue 3 in `services/agents-ui`
**Primary Dependencies**: Spring WebSocket, Spring MVC, Flyway, jOOQ, Fabric8 Kubernetes client, tmux, xterm.js, Vitest
**Storage**: PostgreSQL `workspace_agent_sessions`; workspace PVC mounted at `/workspace`; gateway tmux state currently under `/tmp/agent-gateway`
**Testing**: Service unit tests via `./gradlew :services:agent-gateway:test :services:agents-api:test`; UI checks via `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test` in `services/agents-ui`; backend Gradle execution may be CI-only in worker environments
**Target Platform**: k3s runner pods with one workspace PVC mounted read/write once, browser websocket clients
**Project Type**: mixed service/ui/platform
**Performance Goals**: Reconnect within retained transcript window transfers only the output gap; stale epoch or evicted offset falls back to a full snapshot; heartbeat and reconnect cadence stay unchanged
**Constraints**: Websocket envelope is additive and backward-compatible; no native CLI conversation resume is required; persisted transcript is bounded and reclaimable; rolling restarts must not create two writers for one session id
**Scale/Scope**: Multiple concurrent workspace sessions, each with an independent capped transcript keyed by `WorkspaceAgentSessionId`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Agent-surface parity is preserved for agent-facing behavior
- [x] Rendered artifacts are updated by the owning renderer when source changes require it
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification command is identified for each touched area

## Architecture

### Gateway: Durable Transcript and Attach Cursor

`services/agent-gateway` remains the terminal byte-stream owner. `AgentSession`
gets a per-tmux-session `epoch: Long` set by `AgentSessionManager.spawn()`.
Spawn also accepts the stable pod-independent session id from the API and uses
it to key transcript files on the workspace PVC, for example under
`/workspace/.agent-sessions/{sessionId}/`.

The existing pipe-pane log becomes the durable transcript source instead of an
ephemeral `/tmp` conduit. A transcript store tracks logical byte bounds:
`logStart` is the first retained byte after front trim and `logLen` is the next
post-write byte offset. Front trimming keeps the newest bytes up to the
configured cap, unlike the current truncate-to-zero behavior. Long-running
sessions therefore stay bounded while retained offsets remain byte-addressable.

`LogTailer.start()` gains a `startOffset` parameter. The tailer seeks from the
requested logical byte offset, carries partial UTF-8 sequences as it already
does, and emits each output chunk with the post-chunk byte offset. `AgentAttachHandler`
parses optional `epoch` and `offset` query parameters:

- RESUME when `epoch == currentEpoch` and `logStart <= offset <= logLen`: skip
  the snapshot, send one control frame `{"epoch": currentEpoch, "snapshot": false}`,
  and tail from `offset`.
- SNAPSHOT otherwise: send one control frame `{"epoch": currentEpoch, "snapshot": true}`,
  replay the available durable transcript/current capture path as the full
  repaint, and start live tailing at EOF.

Outbound frames stay backward-compatible:

```json
{ "output": "...utf8...", "off": 12345 }
```

Old clients may ignore `off`, `epoch`, and `snapshot`. Inbound frames remain
unchanged.

A single-writer guard is acquired per stable session id before a gateway starts
or appends to a transcript. The guard should be durable enough to protect
rolling restarts on the same PVC, include an owner/generation marker, and handle
stale owners after an unplanned pod death.

### API: Pod-Independent Session Registry and Restart Flow

`services/agents-api` already persists `WorkspaceAgentSession` rows in
PostgreSQL. This registry becomes the source of truth for the logical session
id, current gateway binding, lifecycle, and current epoch/generation. A
restart/continue command starts a new runner generation for an existing session
id, preserves the workspace PVC, spawns a fresh gateway agent with the same
stable session id, bumps the epoch, updates the gateway binding, and appends a
visible continuation delimiter such as `agent restarted (updated setup)`.

`SessionAttachHandler.resolveAttach()` appends the browser's optional
`epoch`/`offset` query string to the upstream
`/ws/agents/{gatewayAgentId}/attach` URI. The handler continues to relay frames
verbatim in both directions.

Runner re-provisioning must preserve resumable session metadata. Idle
scale-down may stop the pod/service and leave the workspace PVC mounted later,
but it must not delete or mark resumable sessions as unrecoverable. On a later
attach or explicit restart/continue, the API re-provisions the runner and
re-binds the same logical session id to a new gateway process.

### UI: Resume Cursor and Snapshot-Aware Terminal

`services/agents-ui/src/features/workspaces/services/sessionSocket.ts` tracks
`lastOff` and `lastEpoch` from inbound frames. The first connection omits query
parameters so the gateway snapshots. Reconnects append `?epoch={lastEpoch}&offset={lastOff}`
only after both values have been learned. A new `onControl(epoch, snapshot)`
callback is fired for control frames, and output frames continue to call
`onOutput`.

`SessionTerminal.vue` removes the unconditional reconnect reset. It clears only
when `snapshot === true` via `term.clear()` and otherwise keeps the current
scrollback and selection while the socket appends the retained gap and live
output.

The restart/continue UI control itself belongs to the next UI spec; this feature
provides the socket behavior and API surface it will consume.

## Data Model

**Durable session**

- `sessionId`: stable `WorkspaceAgentSessionId`, independent of pod and gateway
  short id
- `workspaceId`, `kind`, `runMode`, `status`: existing session fields
- `gatewayAgentId`: current gateway process binding, nullable while not bound
- `epoch`: monotonically increasing session generation used by attach cursors
- `createdAt`, `updatedAt`: existing timestamps
- Optional operational fields as needed: restart reason, current generation
  owner, last restart timestamp

**Persisted transcript**

- `sessionId`: stable id used in the PVC path
- `path`: transcript log path under the workspace PVC
- `logStart`: first retained logical byte offset
- `logLen`: post-end logical byte offset
- `capBytes`: configured per-session retention cap
- `updatedAt`: last append/trim time

**Session epoch**

- Current epoch is passed into gateway spawn and stored in the gateway
  `AgentSession` for the lifetime of that pod process.
- API increments the epoch for restart/continue and for re-establishing a
  session after an unavailable runner.
- An epoch mismatch always forces a snapshot so stale clients cannot resume
  against a different generation.

**Attach guard**

- `sessionId`: guarded logical session
- `owner`: pod or gateway owner id
- `epoch`: generation protected by the guard
- `leaseUntil` or equivalent stale-owner signal
- Release occurs on normal stop/shutdown; stale guard recovery is required for
  unplanned pod death.

## Project Structure

### Documentation

```text
specs/002-session-persistence-restart/
|-- spec.md
|-- plan.md
`-- tasks.md
```

The websocket attach contract is the existing additive protocol read from
`/workspace/personal-stack/specs/002-assistant-responsiveness-streaming-chat-terminal/contracts/ws-attach-resume.md`.
No additional support documents are written in this worker slice.

### Source Code

```text
services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/config/GatewayProperties.kt
services/agent-gateway/src/main/resources/application.yml
services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/AgentSessionManager.kt
services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/LogTailer.kt
services/agent-gateway/src/main/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandler.kt
services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/tmux/LogTailerTest.kt
services/agent-gateway/src/test/kotlin/com/jorisjonkers/personalstack/agentgateway/ws/AgentAttachHandlerTest.kt

services/agents-api/src/main/resources/db/migration/
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/model/WorkspaceAgentSession.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/port/WorkspaceAgentSessionRepository.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/persistence/JooqWorkspaceAgentSessionRepository.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/domain/port/AgentGatewayClient.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/integration/HttpAgentGatewayClient.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/application/command/StartAgentSessionCommandHandler.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/SessionAttachHandler.kt
services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/web/AgentSessionController.kt
services/agents-api/src/test/kotlin/com/jorisjonkers/personalstack/agents/

services/agents-ui/src/features/workspaces/services/sessionSocket.ts
services/agents-ui/src/features/workspaces/components/SessionTerminal.vue
services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts
services/agents-ui/src/features/workspaces/__tests__/SessionTerminal.test.ts
```

**Structure Decision**: Keep durable terminal behavior local to the existing
gateway/API/UI ownership boundaries. Do not introduce a new service. Persist
terminal bytes on the existing workspace PVC and persist logical session
metadata in the existing API database.

## Phase 0: Outline & Research

1. Confirm existing gateway attach path, tailer behavior, and tmux log cap.
2. Confirm API session persistence and runner re-provisioning preserve the
   workspace PVC.
3. Confirm UI websocket reconnect currently resets the terminal on reopen.
4. Confirm additive attach contract: optional query, control frame, optional
   `off`.

**Output**: Research is embedded in this plan because only `plan.md` and
`tasks.md` are in scope.

## Phase 1: Design & Contracts

1. Use the data model above for durable session, transcript, epoch, and attach
   guard.
2. Use the existing additive websocket contract without changing inbound frame
   shapes.
3. Keep API restart/continue additive to existing session routes.
4. Re-run Constitution Check after implementation planning.

**Output**: Data model and contract decisions are embedded in this plan; the
external websocket contract remains the source for frame shape.

## Phase 2: Task Planning Approach

`tasks.md` is authored in this worker slice by explicit request. Tasks are
ordered by foundation, then user story priority. Within each user story the work
flows gateway to API to UI to focused tests, with backend validation noted as
CI-backed where local worker environments cannot run Gradle.

## Risks and Mitigations

- PVC sizing and retention: per-session caps and stopped-session cleanup are
  required before broad rollout.
- Offset eviction/log rotation: if `offset < logStart` or `offset > logLen`,
  the gateway must snapshot instead of attempting a partial replay.
- Idle scale-down: stopping a runner must not delete the workspace PVC or mark a
  resumable session unrecoverable.
- Gateway epoch lifetime: gateway epoch state is in memory for the current pod
  lifetime; the API must pass and persist the authoritative next epoch.
- Rolling restart overlap: a durable single-writer guard is required even with a
  read/write-once PVC because same-node overlap can otherwise corrupt a file.
- Snapshot size: full transcript replay can be large within cap; chunking and
  caps must keep frames and memory bounded.

## Complexity Tracking

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
- [x] All open clarifications resolved
