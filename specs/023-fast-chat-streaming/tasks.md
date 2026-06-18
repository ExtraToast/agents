# Tasks: 023-fast-chat-streaming

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (touches different files)
- Sequencing gate (FR-006): the new generation path must be LIVE and verified before LightRAG-for-chat is removed.

## Phase 1: Setup

- [ ] T001 Confirm local run of agents-api + agent-gateway and a bound agent-runner Pod; capture the smallest verify commands (`:services:agents-api:check`, `:services:agent-gateway:check`).
- [ ] T002 Spike: measure first-token latency of a runner headless job streamed via agent-gateway `HeadlessJobManager`/`LogTailer`, vs current LightRAG mix-mode, on the same prompt. Record whether tmux `LogTailer` buffering needs a direct stream channel. (Resolves the plan's top risk.)

## Phase 2: Foundational

- [ ] T003 Define the generation-backend port in agents-api (a `ChatGenerationPort` returning a token stream / callback), with a runner-Pod adapter over agent-gateway. File: `services/agents-api/.../application/chat/` + `infrastructure/integration/`.
- [ ] T004 Add the bounded conversation-history reader (window from `ChatMessageRepository`, always includes latest user turn). File: `application/chat/`.
- [ ] T005 Add config flag `chat.generation.backend = lightrag | runner-pod` (default `lightrag` initially) so the new path lands dark. File: `config/` + `application.yml`.

## Phase 3: User Story 1 — Fast low-latency streaming (P1)

- [ ] T006 [US1] Bridge the runner headless-job token stream into `ChatAnswerStreamService` via `ChatGenerationPort`, emitting `chunk` events unchanged. File: `application/chat/ChatAnswerStreamService.kt`.
- [ ] T007 [US1] Preserve SSE contract + timeout + terminal `error`/`done` semantics (per `contracts/sse-events.md`). File: same + `infrastructure/web/ChatSessionController.kt`.
- [ ] T008 [US1] Tests: extend the existing chat-stream test to assert `chunk`/`done`/`error` parity against the new backend and assert first-token within budget (SC-001, SC-005). File: `services/agents-api/src/test/.../chat/`.

## Phase 4: User Story 2 — Multi-turn conversation (P1)

- [ ] T009 [US2] Supply the bounded history (T004) to the generation request so follow-ups are context-aware. File: `application/chat/`.
- [ ] T010 [US2] Persist the assistant answer to history as today (`AppendChatMessageCommand`). File: `application/chat/`.
- [ ] T011 [P] [US2] Integration test: a follow-up that depends on a prior turn is answered using history (SC-002). File: `src/integrationTest/.../chat/`.

## Phase 5: User Story 3 — Optional KB grounding decoupled from LightRAG (P2)

- [ ] T012 [P] [US3] Route on `ChatSessionKind`: `KNOWLEDGE` runs `RetrievalPort` retrieve-then-prompt and passes snippets as context; `PLAIN` skips retrieval. Neither calls LightRAG. File: `application/chat/` + `domain/model/ChatSessionKind.kt`.
- [ ] T013 [P] [US3] Tests: `KNOWLEDGE` injects retrieved context, `PLAIN` does not, neither hits `streamQuery` (SC-003, SC-004). File: `src/test/.../chat/`.

## Phase 6: Cutover & Removal (gated by FR-006)

- [ ] T014 Flip `chat.generation.backend` default to `runner-pod` after T002/T008 verify latency + parity. File: `application.yml`.
- [ ] T015 (Optional, if grounding quality is in doubt) Benchmark retrieve-then-prompt vs LightRAG mix-mode grounding before removal.
- [ ] T016 Remove `LightRagClient.streamQuery` and the concrete `LightRagClient` dependency from `ChatAnswerStreamService`; add a grep gate asserting no chat path references `streamQuery` (SC-003). Files: `application/chat/ChatAnswerStreamService.kt`, `infrastructure/integration/LightRagClient.kt`.

## Phase 7: Polish & Validation

- [ ] T017 Run `:services:agents-api:check` and `:services:agent-gateway:check`; confirm no new secret added to agents-api config (SC-006).
- [ ] T018 Update `quickstart.md` / chat runbook with the new path and the `ChatSessionKind` behavior.

## Dependencies

- T002 (spike) gates the T003 adapter design and T014 cutover.
- T003 → T006 → {T009, T012}; T004 → T009.
- T016 (removal) depends on T014 cutover being live and verified (FR-006).
- US1 (T006-T008) is the keystone; US2/US3 build on the same generation path.

## Parallel Example

```
T011 [P] [US2] history integration test
T012 [P] [US3] ChatSessionKind grounding routing
T013 [P] [US3] grounding tests
```

**Count**: 18 tasks. **Parallelizable**: 4 (`[P]`). **Readiness**: ready for `/speckit.analyze`.
