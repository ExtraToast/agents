# Implementation Plan: Fast Chat Streaming

**Branch**: `023-fast-chat-streaming` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)
**Input**: Replace LightRAG-as-chat-generator with a fast, multi-turn streaming path that reuses the agent-runner Pod.

## Summary

Chat answers are generated today only by `LightRagClient.streamQuery` (mix-mode hybrid retrieval + generation), single-turn and slow. agents-api has no LLM client of its own. The architecture already anticipated the fix: `ChatSessionKind.KNOWLEDGE` is documented as "operates on the KB via an agent-runner Pod… Pod binding + streaming land in a follow-up." This feature implements that follow-up: bind a chat session to a runner-Pod headless generation job and stream its tokens into the existing chat SSE, with bounded conversation history and optional KB grounding, then retire `streamQuery`.

## Technical Context

**Language/Version**: Kotlin 2.x (agents-api, agent-gateway), Spring Boot.
**Primary Dependencies**: Spring MVC `SseEmitter` (chat), agent-gateway WebSocket attach + tmux `LogTailer` + `HeadlessJobManager` (runner streaming), `HttpAgentGatewayClient` (REST control plane).
**Storage**: Postgres `chat_session_messages` (history; jOOQ `ChatMessageRepository`).
**Testing**: Gradle (`:services:agents-api:check`, `:services:agent-gateway:check`), integration tests.
**Target Platform**: JVM services on k3s; agent-runner Pods.
**Project Type**: mixed (two backend services).
**Performance Goals**: first chunk ≤ ~1.5s (SC-001); incremental token streaming.
**Constraints**: preserve the SSE event contract (`chunk`/`done`/`error`); no new model secret in agents-api; never leave chat backend-less during cutover.
**Scale/Scope**: low-concurrency interactive chat.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] No attribution introduced in files, comments, commit text, or PR text
- [x] Claude/Codex parity preserved — generation runs the runner's configured agent (Claude or Codex), not a Claude-only API client
- [x] Rendered artifacts updated by the owning renderer when source changes require it — N/A (no render-managed config touched)
- [x] Small stacked PR boundary clear — generation-path PR, then grounding-toggle PR, then LightRAG-removal PR; unrelated cleanup excluded
- [x] Verification command identified — `:services:agents-api:check`, `:services:agent-gateway:check`, manual SSE verify

## Project Structure

### Documentation

```text
specs/023-fast-chat-streaming/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/sse-events.md
`-- tasks.md
```

### Source Code

```text
services/agents-api/.../application/chat/ChatAnswerStreamService.kt   # repoint generation off LightRAG
services/agents-api/.../infrastructure/web/ChatSessionController.kt    # SSE endpoint (unchanged contract)
services/agents-api/.../domain/model/ChatSessionKind.kt               # PLAIN vs KNOWLEDGE routing
services/agents-api/.../infrastructure/integration/HttpAgentGatewayClient.kt  # control-plane calls
services/agents-api/.../infrastructure/ws/SessionAttachHandler.kt     # reference streaming bridge pattern
services/agent-gateway/.../headless/HeadlessJobManager.kt             # headless generation job
services/agent-gateway/.../tmux/LogTailer.kt                          # token stream source
```

**Structure Decision**: Generation moves to a runner-Pod headless job driven via agent-gateway; agents-api bridges that stream into the chat `SseEmitter`. Retrieval (for `KNOWLEDGE` grounding) reuses the `RetrievalPort` path; it does NOT depend on feature 015 landing first (015 only makes sources individually toggleable), but 015's flag-split is compatible and preferred to ship first.

## Phase 0: Outline & Research

Resolved unknowns (see `research.md`):
1. **Streaming transport** — runner output already streams via agent-gateway WebSocket attach + tmux `LogTailer`; `HeadlessJobManager` runs one-shot headless jobs. This is the generation primitive; agents-api bridges it to the chat SSE. `HttpAgentGatewayClient` is REST control-plane only (no token stream).
2. **Credential** — runner Pods already hold the agent (Claude/Codex) credential + MCP tools; no new secret in agents-api (SC-006).
3. **History** — `ChatMessageRepository` already persists turns; supply a bounded window to the generation prompt.
4. **Grounding** — `KNOWLEDGE` kind runs `RetrievalPort` first and passes snippets as context; `PLAIN` skips it. Neither calls LightRAG.

**Output**: `research.md`

## Phase 1: Design

- **data-model.md**: conversation-history window (count/char bound); `ChatSessionKind` routing table.
- **contracts/sse-events.md**: the preserved `chunk`/`done`/`error` SSE contract (must not change for clients).
- **quickstart.md**: run agents-api + agent-gateway locally, open a chat session, observe streamed tokens from a headless runner job.

## Phase 2: Sequencing & Risk Gates

1. **Generation-path PR** — bridge a runner-Pod headless job stream into `ChatAnswerStreamService` behind a config flag (LightRAG still default). Verify first-token latency.
2. **Grounding-toggle PR** — wire `KNOWLEDGE`-kind retrieve-then-prompt; `PLAIN` stays ungrounded.
3. **Cutover + removal PR** — flip default to the new path; after a release, delete `LightRagClient.streamQuery` + the concrete dependency (FR-006 gate).

## Unresolved Risks

- **Transport latency**: streaming through tmux `LogTailer` may add buffering latency; measure before committing the SSE bridge design (could need a direct headless stream channel).
- **Pod warm-up**: binding a runner Pod per chat turn could dominate first-token time; evaluate a warm/bound session reused across turns (the `KNOWLEDGE` session binding model already implies a persistent bind).
- **Grounding quality**: retrieve-then-prompt vs LightRAG mix-mode fusion — if quality regresses, add a benchmarking task before removal (FR-006 keeps the old path until then).

**Readiness**: ready for `/speckit.tasks`.
