# Feature Specification: Fast Chat Streaming

**Feature Branch**: `023-fast-chat-streaming`
**Created**: 2026-06-18
**Status**: Draft
**Input**: Chat streaming feels slow and single-turn. Decide whether LightRAG adds real value for chat and, if not, replace it with a faster, multi-turn generation path.

## Context & Verified Ground Truth

*Verified against the current tree (2026-06-18); Codex cross-review confirmed.*

- `ChatAnswerStreamService.kt:46` generates answers by calling `LightRagClient.streamQuery` and sends `chunk` SSE events. It loads the session only to check existence (`:29`) and **passes only the latest `userBody`** — no conversation history is sent.
- `LightRagClient.streamQuery` (`LightRagClient.kt:73-116`) hits LightRAG `/query/stream` in **`mode="mix"`** (hybrid knowledge-graph + vector retrieval, then generation). Grounding over the KB is the **only** value it adds to chat.
- **`agents-api` has no LLM client or model credential** of its own (no Anthropic/OpenAI/Spring-AI dependency anywhere). `LightRagClient.streamQuery` is the *only* generation backend today.
- `ChatSessionKind` already exists with two values: `PLAIN` ("messages are persisted and nothing else happens server-side") and `KNOWLEDGE` ("operates on the knowledge base via an **agent-runner Pod** calling the `knowledge.*` MCP tools. The Pod binding + streaming land in a **follow-up**"). The architecture already anticipated routing chat through a runner Pod.
- `HttpAgentGatewayClient` and the Fabric8 orchestrator already bind and drive agent-runner Pods (which hold Claude credentials + MCP tools).

**Answer to "is LightRAG shoehorned into chat?"**: It adds one real thing — KB-grounded answers — but the wiring is the wrong shape (stateless single-turn, full hybrid-retrieval+generation latency per message, generation model is whatever LightRAG runs, and it couples chat to the retrieval backend being slimmed). The lowest-surface, already-designed fix is the deferred `KNOWLEDGE`-kind follow-up: bind chat to a runner Pod and stream from there.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast, low-latency streaming (Priority: P1)

As a chat user, I see the answer begin streaming almost immediately and token-by-token, instead of waiting for a slow hybrid retrieval+generation round trip.

**Why this priority**: This is the reported pain ("not super good"). First-token latency is dominated by LightRAG mix-mode doing KG traversal + vector search before any token streams.

**Independent Test**: Send a chat message; measure time-to-first-chunk and confirm it is materially lower than the LightRAG path on the same prompt.

**Acceptance Scenarios**:

1. **Given** a chat session, **When** a message is sent, **Then** the first `chunk` SSE event arrives in under a target first-token budget (see SC-001) and subsequent chunks stream incrementally.
2. **Given** a generation error mid-stream, **When** it occurs, **Then** a terminal `error` event with `retryable` is emitted and the emitter completes (parity with today's behavior).

---

### User Story 2 - Multi-turn conversation (Priority: P1)

As a chat user, follow-up messages are answered with awareness of earlier turns in the same session, so the conversation is coherent.

**Why this priority**: Today only the latest message is sent — there is no real multi-turn chat. This is a correctness gap, not just speed.

**Independent Test**: Ask a question, then a follow-up that only makes sense with prior context; confirm the answer uses the earlier turn.

**Acceptance Scenarios**:

1. **Given** a session with prior turns, **When** a new message is sent, **Then** the generation request includes the prior conversation history (bounded by a documented window).
2. **Given** the assistant answer completes, **When** it is persisted, **Then** it is appended to the session history (parity with `AppendChatMessageCommand` today).

---

### User Story 3 - Optional KB grounding without coupling to LightRAG (Priority: P2)

As the operator, I can choose whether a chat session is KB-grounded, without that choice forcing generation through LightRAG.

**Why this priority**: Grounding is the one real LightRAG benefit; it should survive as an *option* (retrieve-then-prompt) decoupled from the generator, so dropping LightRAG-as-generator does not drop grounding.

**Independent Test**: Run a `KNOWLEDGE`-kind session and confirm retrieved snippets inform the answer; run a `PLAIN` session and confirm none are injected — both stream from the same fast generation path.

**Acceptance Scenarios**:

1. **Given** a `KNOWLEDGE`-kind session, **When** a message is sent, **Then** retrieval runs first and the snippets are supplied to the generation request as context.
2. **Given** a `PLAIN`-kind session, **When** a message is sent, **Then** no retrieval occurs and the answer streams from the generation path directly.
3. **Given** either kind, **When** generation runs, **Then** it does NOT call `LightRagClient.streamQuery`.

### Edge Cases

- LightRAG-as-generator must not be deleted until the new generation path is live (chat must never be backend-less).
- A runner Pod that fails to bind must surface a retryable error, not hang past the SSE timeout (`120_000ms` today).
- Very long histories must be truncated to the documented window without dropping the latest user turn.
- Grounding retrieval that returns nothing must still allow a normal (ungrounded) answer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Chat answer generation MUST stream token-by-token from a generation backend that is NOT `LightRagClient.streamQuery`.
- **FR-002**: The generation path MUST reuse the existing agent-runner Pod / agent-gateway mechanism (which already holds model credentials + MCP tools) rather than introducing a new model credential into agents-api.
- **FR-003**: Generation requests MUST include bounded conversation history for the session (multi-turn), with a documented window.
- **FR-004**: KB grounding MUST be optional and keyed off `ChatSessionKind` (`KNOWLEDGE` grounds via retrieve-then-prompt; `PLAIN` does not), and MUST NOT route generation through LightRAG.
- **FR-005**: The SSE contract (`chunk` / `done` / `error` events, `retryable` flag, completion semantics) MUST be preserved for existing clients.
- **FR-006**: `LightRagClient.streamQuery` and the concrete `LightRagClient` dependency in `ChatAnswerStreamService` MUST be removed only AFTER the new path is live and verified (sequencing requirement).
- **FR-007**: Assistant answers MUST continue to be persisted to session history as today.

### Out of Scope

- The retrieval/capture seam refactor (feature `015-memory-seam-decoupling`).
- Replacing LightRAG's *retrieval* role (handled with the backend-swap work).
- Adding a standalone Anthropic/OpenAI client to agents-api (explicitly rejected in favor of the runner-Pod path).

### Key Entities

- **ChatSession / ChatSessionKind**: `PLAIN` vs `KNOWLEDGE`; drives grounding.
- **Generation backend**: the runner-Pod/gateway path producing the streamed answer.
- **Conversation history**: bounded prior turns supplied to generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Time-to-first-chunk for a typical prompt is materially lower than the LightRAG mix-mode path (target: first chunk in ≤ ~1.5s vs the current multi-second wait), measured on the same prompt.
- **SC-002**: A follow-up question that depends on a prior turn is answered correctly using history, verified by an integration test.
- **SC-003**: No code path in chat generation calls `LightRagClient.streamQuery` after this ships, verified by test + grep gate.
- **SC-004**: `PLAIN` and `KNOWLEDGE` sessions both stream from the same generation path; only `KNOWLEDGE` injects retrieved context, verified by tests.
- **SC-005**: The existing SSE event contract is unchanged for clients (no UI change required to keep working), verified by the existing stream test extended.
- **SC-006**: No new model credential/secret is added to agents-api (the runner-Pod credential is reused), verified by config review.

## Assumptions

- The runner-Pod path can stream tokens back to agents-api over the existing gateway transport within the SSE timeout; if a transport gap exists, it is surfaced during planning, not assumed.
- Grounding via retrieve-then-prompt is acceptable quality versus LightRAG mix-mode fusion for the chat use case; if not, a benchmarking task is added before deletion (FR-006 keeps the old path until then).
