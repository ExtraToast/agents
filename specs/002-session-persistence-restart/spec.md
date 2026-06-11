# Feature Specification: Durable agent sessions — restart with full history

**Feature Branch**: `002-session-persistence-restart`
**Created**: 2026-06-11
**Status**: Draft
**Input**: Make it possible to restart the agent container with all history
attached, so a session can be continued after the agent setup is updated.

## Overview

Today an agent session lives entirely in the runner pod: the gateway runs the
agent in a tmux session and tails its output log, but that log and the tmux
session are on ephemeral pod storage. Restarting the runner pod — for example to
pick up an **updated agent setup** (new CLI/MCP version, changed config, new
image) — loses the session: the scrollback is gone and the conversation can't be
continued.

This feature makes a session **durable across pod restarts**. A session's
transcript/scrollback is persisted to durable storage keyed by a stable session
id. When the runner pod restarts (intentionally, to adopt an updated setup, or
unintentionally), the session is re-established and its full history is replayed
into the terminal, so the operator continues exactly where they left off — now
running the updated agent.

Builds directly on the gateway's existing tmux + byte-offset log tailer and the
offset/epoch reconnect design (responsiveness spec, Phase 2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continue a session after restarting with an updated setup (Priority: P1)

The operator has a running agent session with meaningful scrollback. They update
the agent setup (e.g. a newer CLI/MCP image or changed config) and restart the
runner. After the restart, they open the session and see its full prior history,
then keep working — the now-updated agent continues the same logical session.

**Why this priority**: This is the core ask — restart to adopt a new setup
without losing the session.

**Independent Test**: Produce scrollback in a session, restart the runner pod
with a changed image/config, reopen the session — the full prior transcript is
present and new input/commands work against the updated agent.

**Acceptance Scenarios**:

1. **Given** a session with history, **When** the runner pod is restarted with an
   updated image/config, **Then** reopening the session shows the complete prior
   transcript followed by a clearly-marked continuation under the new setup.
2. **Given** the restart, **When** the operator sends input, **Then** it reaches
   the freshly-started agent process and the session continues as one logical
   thread (same session id).
3. **Given** the updated setup, **When** the session resumes, **Then** the change
   of setup is surfaced (e.g. an epoch/restart marker) rather than silently
   splicing old and new output as if uninterrupted.

### User Story 2 - History survives an unplanned restart (Priority: P2)

If the runner pod dies or is rescheduled, the operator does not lose the session
transcript; on the pod coming back, the session is re-attachable with its history.

**Why this priority**: Durability must hold for crashes/reschedules, not only
intentional restarts.

**Independent Test**: Kill the runner pod mid-session; once rescheduled, the
session's prior transcript is intact and re-attachable.

**Acceptance Scenarios**:

1. **Given** an in-progress session, **When** the pod is killed and rescheduled,
   **Then** the persisted transcript up to the crash is preserved.
2. **Given** the reschedule, **When** the operator reconnects, **Then** they get
   the persisted history and a live, usable terminal again.

### User Story 3 - Bounded, multi-session durable storage (Priority: P3)

Multiple sessions persist independently without unbounded storage growth.

**Why this priority**: Durability must not become a disk-leak; sessions are
bounded and reclaimable.

**Acceptance Scenarios**:

1. **Given** several sessions, **When** they accumulate output, **Then** each
   persists independently keyed by session id, within a bounded per-session cap
   (oldest output trimmed like the existing disk-capped log).
2. **Given** a stopped/archived session, **When** retention elapses, **Then** its
   persisted transcript is reclaimable so storage stays bounded.

### Edge Cases

- Restart while output is mid-stream / mid-UTF-8 sequence — replay must not
  corrupt characters (the tailer already carries partial UTF-8).
- A client reconnecting across the restart with a stale `(epoch, offset)` — epoch
  change MUST force a full snapshot from persisted history, not a wrong diff.
- Persisted history exceeding the per-session cap during a long restart gap —
  fall back to "from current persisted start", clearly marked.
- Two pods briefly claiming the same session id during a rolling restart — the
  session identity/locking must prevent double-attach corruption.
- The agent CLI itself may or may not support resuming its own native session;
  this feature persists and replays the **transcript/scrollback**, and starts a
  fresh agent process under the updated setup unless native resume is explicitly
  in scope (it is not by default — see Non-Goals).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A session MUST have a stable identifier that survives runner pod
  restarts and is independent of the pod/process lifetime.
- **FR-002**: A session's output transcript/scrollback MUST be persisted to
  durable storage (surviving pod restart/reschedule), keyed by that session id.
- **FR-003**: On runner (re)start, the system MUST re-establish the session and
  make the persisted history available to attach/replay — without requiring the
  prior pod.
- **FR-004**: On a client (re)attach after a restart, the full persisted history
  MUST be replayable, followed by live output, with no duplication or loss for
  supported gap sizes (reusing the offset/epoch model).
- **FR-005**: A restart that adopts an updated agent setup MUST advance the
  session epoch so clients take a full snapshot and the continuation is clearly
  delimited from pre-restart output.
- **FR-006**: Sending input after a restart MUST reach the freshly-started agent
  process within the same logical session.
- **FR-007**: Persisted per-session storage MUST be bounded (front-trimmed at a
  cap, like the existing disk-capped log) and reclaimable for
  stopped/archived/expired sessions.
- **FR-008**: Concurrent/rolling restarts MUST NOT corrupt a session
  (single-writer / attach guard on the session id).
- **FR-009**: The feature MUST preserve existing heartbeat/reconnect/idle
  behaviors and the gateway's "dumb byte stream" envelope (additive only).

### Key Entities *(include if feature involves data)*

- **Durable session**: stable id + epoch + persisted output buffer + lifecycle
  state, decoupled from the pod that currently serves it.
- **Persisted transcript**: bounded, ordered, byte-offset-addressable record of a
  session's output on durable storage.
- **Session epoch**: increments on (re)start / updated-setup adoption; drives
  snapshot-vs-replay.
- **Attach guard**: ensures a single active writer per session id across restarts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After restarting the runner with an updated image/config, 100% of
  in-window sessions reopen with their full prior transcript and a usable live
  terminal continuing under the new setup.
- **SC-002**: After an unplanned pod kill/reschedule, the persisted transcript up
  to the failure is intact and the session is re-attachable.
- **SC-003**: Reattach across a restart shows zero duplicated/skipped output for
  supported gap sizes; an epoch change yields a clean full snapshot.
- **SC-004**: Per-session persisted storage stays within its configured cap and
  is reclaimed for stopped/expired sessions (no unbounded growth).
- **SC-005**: No regression in heartbeat/reconnect/idle behavior.

## Assumptions

- Durable storage is a PVC (or equivalent) holding per-session transcript logs,
  keyed by session id (confirmed direction). Exact PVC sizing/retention is a
  planning tuning decision.
- "Updated agent setup" means a new runner image and/or changed agent
  config/MCP; the feature replays the transcript and starts a fresh agent under
  the new setup.
- The session identity/registry lives where the API already tracks workspace
  agent sessions, extended to be pod-independent.

## Non-Goals

- Native in-CLI session resume (continuing the agent's own internal conversation
  state inside the tool) — only the visible transcript/scrollback is persisted +
  replayed; a fresh agent process starts under the updated setup.
- Cross-cluster/offsite durability beyond the PVC.
- The repo extraction/rename (spec 001) and UI redesign (spec 003), though the UI
  surfaces the restart/continue controls (spec 003).
