# Tasks: 015-memory-seam-decoupling

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files)
- Two serialized sub-changes (separate PRs): **A** = flag split, **B** = port split. B depends on A.
- Refactor invariant: no observable behavior change at defaults (FR-007 / SC-002).

## Phase 1: Setup

- [ ] T001 Confirm baseline `./gradlew :services:agents-api:check` is green before any change (captures the no-diff reference).

## Phase 2: Foundational (none beyond setup — interfaces already exist in `RetrievalPort.kt`)

## Phase 3: User Story 1 — Toggle retrieval & capture independently (P1) [Sub-change A]

- [ ] T002 [US1] Add `rag.retrieval.enabled` + `rag.capture.enabled` to `RagProperties.kt`; keep `rag.enabled` as deprecated master toggle (false ⇒ both off). File: `config/RagProperties.kt` + `application.yml`. (Sole owner of these two files in PR A.)
- [ ] T003 [US1] Rewire `ContextBuilder.kt:33` to read `rag.retrieval.enabled` (AND master toggle). File: `application/rag/ContextBuilder.kt`.
- [ ] T004 [US1] Rewire `LessonAutoCapture.kt:48` to read `rag.capture.enabled` (AND master toggle). File: `application/rag/LessonAutoCapture.kt`.
- [ ] T005 [US1] Extend `ContextBuilderTest` + `LessonAutoCaptureTest` for all four flag combinations and the deprecated-master rollback (SC-001). Files: `src/test/.../rag/`.

## Phase 4: User Story 2 — Per-source enable/disable + coexistence ranking (P1) [Sub-change B]

- [ ] T006 [US2] Add `@ConditionalOnProperty` to `LightRagClient` and to the new recall client (T008), each behind a `rag.sources.<name>.enabled` flag (default true). Files: `infrastructure/integration/`.
- [ ] T007 [US2] Implement the documented coexistence ranking rule in `ContextBuilder` so a fixed score-1.0 source does not dominate the floor (per `data-model.md`). File: `application/rag/ContextBuilder.kt`.
- [ ] T008 [P] [US2] Extend `ContextBuilderTest`: disabled source absent from merge (SC-003); score-1.0 source + genuinely-scored source rank by the rule, floor still applies. Files: `src/test/.../rag/`.

## Phase 5: User Story 3 — Recall/write split preserving dedup (P2) [Sub-change B]

- [ ] T009 [US3] Split `KnowledgeMcpClient` into `KnowledgeRecallClient` (`RetrievalPort`, conditional) + `KnowledgeWriteClient` (`KnowledgeWritePort`, the single write bean). File: `infrastructure/integration/`.
- [ ] T010 [US3] Preserve `findDuplicateEvidence` (0.86) on the write path, or record an explicit accepted regression in this spec's assumptions (FR-006). File: `infrastructure/integration/KnowledgeWriteClient.kt`.
- [ ] T011 [P] [US3] Extend `KnowledgeMcpClientTest` (now split across the two clients) — pin recall + write contract behavior, not JSON-RPC wire shape. Files: `src/test/.../integration/`.
- [ ] T012 [US3] Context-load test: exactly one `KnowledgeWritePort` bean exists, no ambiguous-bean failure (SC-005). File: `src/integrationTest/.../`.
- [ ] T013 [US3] Dedup-parity test: same lesson captured twice ⇒ second suppressed at 0.86 (SC-004). File: `src/test/.../rag/`.

## Phase 6: Polish & Validation

- [ ] T014 Run `./gradlew :services:agents-api:check`; diff behavior against the T001 reference — must be identical at defaults (SC-002).
- [ ] T015 Update `quickstart.md` and note the deprecated `rag.enabled` removal in the following release.

## Dependencies

- Sub-change A: T002 → {T003, T004} → T005. Ships as PR A.
- Sub-change B (depends on A merged): T009 → {T006, T007, T010}; tests T008/T011/T012/T013. Ships as PR B.
- T002, T007, T009 all touch shared files (`RagProperties.kt`, `ContextBuilder.kt`) — serialized within their PR, never parallel.

## Parallel Example

```
T008 [P] [US2] ContextBuilder ranking tests
T011 [P] [US3] split KnowledgeMcpClient tests
```

**Count**: 15 tasks. **Parallelizable**: 2 (`[P]`, test-only). **Readiness**: ready for `/speckit.analyze`.
