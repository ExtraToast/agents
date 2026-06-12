# Brief: implement 002 — durable sessions (restart with full history)

Implement the feature already specified in this repo at
`specs/002-session-persistence-restart/` — read its **spec.md** (WHAT/FRs),
**plan.md** (architecture + per-service design), and **tasks.md** (the ordered
56-task breakdown). Produce a working implementation matching them. The exact
additive websocket frame protocol is at
`/workspace/personal-stack/specs/002-assistant-responsiveness-streaming-chat-terminal/contracts/ws-attach-resume.md`.

## Services (this repo, /workspace/agents)

- **agent-gateway** (`services/agent-gateway`, Kotlin): per-tmux-session `epoch`
  set in `AgentSessionManager.spawn()`; `LogTailer` start-at-offset; parse
  `?epoch&offset` in `ws/AgentAttachHandler` → RESUME (skip snapshot, tail from
  offset, control frame `{epoch,snapshot:false}`) vs SNAPSHOT (`{...,true}`); add
  running `off` to `{output}` frames; PVC-backed per-session transcript keyed by
  a stable session id; front-trim at a cap (replace truncate-to-zero); single-
  writer attach guard with stale-owner recovery.
- **agents-api** (`services/agents-api`, Kotlin): pass `epoch/offset` query through
  `ws/SessionAttachHandler.resolveAttach` (relay already verbatim); pod-independent
  session registry; a 'restart & continue' command/route (new runner generation
  for an existing session id, epoch bump + delimiter); Flyway migration + jOOQ for
  any new session fields; preserve resumable sessions during idle scale-down.
- **agents-ui** (`services/agents-ui`, Vue/TS): in `features/workspaces/services/sessionSocket.ts`
  track `lastOff/lastEpoch` + `onControl(epoch,snapshot)` + lazy reconnect URL with
  `?epoch&offset`; in `components/SessionTerminal.vue` remove the unconditional
  reconnect `term.reset()` and clear only on `snapshot===true` via `term.clear()`.

## Constraints

- Backward-compatible: old clients ignore `off`/`epoch`/`snapshot`; absent query → snapshot.
- Branch off `main`. Follow `.specify/memory/constitution.md`: NO attribution, never
  the names Claude/Codex/AI in any commit/PR/file/comment; impersonal voice; small
  changes; validate against the real code.
- Workers CANNOT run `./gradlew` or open sockets (sandbox). Write the Kotlin + tests
  by inspection; the orchestrator verifies the backend via CI (Pipeline Complete).
  agents-ui checks (`pnpm typecheck/lint/test`) CAN run.
- Preserve heartbeat/reconnect/idle behavior (additive only).

## Done = code + co-located tests matching spec 002's FRs/tasks; agents-ui typecheck/lint/test green; backend compiles (CI-verified); no unrelated changes.
