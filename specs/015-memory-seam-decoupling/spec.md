# Feature Specification: Memory Seam Decoupling

**Feature Branch**: `015-memory-seam-decoupling`
**Created**: 2026-06-18
**Status**: Draft
**Input**: Decouple the agents-api RAG retrieval/capture seam so the knowledge backend can be slimmed or swapped without breaking recall, capture, or chat.

## Context & Verified Ground Truth

*All claims verified against the current tree (2026-06-18); Codex cross-review confirmed.*

- `RagProperties.enabled` (`RagProperties.kt:7`) is a **single boolean** gating BOTH retrieval (`ContextBuilder.kt:33`) AND capture (`LessonAutoCapture.kt:48`).
- `KnowledgeMcpClient` is a **single `@Component` implementing BOTH `RetrievalPort` and `KnowledgeWritePort`**, and is the **only** `KnowledgeWritePort`.
- `ContextBuilder` injects `List<RetrievalPort>` and fans out over **every** bean; both `KnowledgeMcpClient` and `LightRagClient` implement `RetrievalPort`. The retrieval beans carry **no per-bean `@ConditionalOnProperty`** (such conditionals exist elsewhere, e.g. `VaultDeployKeyStore.kt:31`, but not here).
- `LightRagClient.retrieve` returns a single blob at **score 1.0** (`LightRagClient.kt:66`) that always clears `minScore=0.3`.
- Capture dedup is first-class: `LessonAutoCapture.kt:99` calls `findDuplicateEvidence(query, autoCaptureDedupeScore=0.86)` before spending the write budget.

This feature is a **behavior-preserving refactor** that unblocks a later backend swap (separate features). It is the foundational seam everything downstream depends on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle retrieval and capture independently (Priority: P1)

As the platform operator, I can disable knowledge **retrieval** while leaving **capture** running (and vice versa), so I can stage a backend migration without an all-or-nothing switch.

**Why this priority**: This is the core unblock. Today one boolean controls both, so any migration is a cliff. Independent gating is what makes every later phase incremental and reversible.

**Independent Test**: Set `rag.retrieval.enabled=false`, `rag.capture.enabled=true`; confirm no context envelope is injected but lessons are still captured. Then invert and confirm the opposite.

**Acceptance Scenarios**:

1. **Given** `rag.retrieval.enabled=false` and `rag.capture.enabled=true`, **When** a user prompt is augmented, **Then** no `<context>` envelope is added, **and** an eligible turn still writes a captured lesson.
2. **Given** `rag.retrieval.enabled=true` and `rag.capture.enabled=false`, **When** an eligible turn completes, **Then** no lesson is written, **and** retrieval still injects context.
3. **Given** the deprecated `rag.enabled=false` master toggle, **When** either path runs, **Then** both retrieval and capture are disabled (backward-compatible rollback).

---

### User Story 2 - Enable/disable individual retrieval sources (Priority: P1)

As the operator, I can enable or disable each retrieval source independently (the existing KB recall client, LightRAG, or a future source) so I can introduce a new backend without a second live source silently double-injecting.

**Why this priority**: `ContextBuilder` fans out over all `RetrievalPort` beans with no conditional, so "use the new source but not the old recall client" is impossible today. Without this, a backend swap leaves two live sources.

**Independent Test**: Disable the recall client via its property; confirm `ContextBuilder` no longer queries it and only the remaining enabled source contributes snippets.

**Acceptance Scenarios**:

1. **Given** the KB recall source is disabled via its `@ConditionalOnProperty`, **When** retrieval runs, **Then** that bean is absent from the injected `List<RetrievalPort>` and contributes no snippets.
2. **Given** two retrieval sources are enabled where one always returns score 1.0, **When** results are merged, **Then** the documented precedence/coexistence rule (not raw score 1.0 dominance) determines ranking and the score floor still applies.
3. **Given** all retrieval sources are disabled, **When** retrieval runs, **Then** `sources.isEmpty()` is the genuine NoOp path and the prompt is returned unchanged.

---

### User Story 3 - Replace the write side without losing dedup (Priority: P2)

As the operator, I can split the recall and write responsibilities into separate components so the write side can later be replaced, **without** silently losing duplicate-suppression on capture.

**Why this priority**: `KnowledgeMcpClient` is the only `KnowledgeWritePort`. A naive split or replacement that drops `findDuplicateEvidence` re-creates the low-signal-memory problem (every near-duplicate writes).

**Independent Test**: After the split, capture the same lesson twice; confirm the second is suppressed at the 0.86 dedup threshold.

**Acceptance Scenarios**:

1. **Given** the recall and write responsibilities are separate components (`KnowledgeRecallClient` : `RetrievalPort`, `KnowledgeWriteClient` : `KnowledgeWritePort`), **When** the system boots, **Then** exactly one `KnowledgeWritePort` bean exists and capture behaves identically to before.
2. **Given** an already-captured lesson, **When** a near-identical lesson is captured, **Then** `findDuplicateEvidence` at `0.86` suppresses the second write — dedup parity is preserved (or an accepted regression is explicitly recorded).

### Edge Cases

- Old config using only `rag.enabled` must keep working for one release (deprecated master toggle).
- A retrieval source that throws must not abort the merge (existing resilience preserved).
- The score-1.0 LightRAG blob must not crowd out genuinely-scored snippets once a second source exists.
- Disabling capture must not disable the turn-history read path used elsewhere.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose `rag.retrieval.enabled` and `rag.capture.enabled` that independently gate retrieval and capture respectively.
- **FR-002**: System MUST retain `rag.enabled` for one release as a deprecated master toggle whose `false` value disables both concerns (rollback path).
- **FR-003**: System MUST separate recall and write responsibilities into distinct components such that exactly one `KnowledgeWritePort` exists and recall sources are individually toggleable.
- **FR-004**: System MUST guard each `RetrievalPort` implementation with a per-bean conditional so any source can be enabled/disabled without removing code.
- **FR-005**: System MUST apply a documented precedence/coexistence ranking rule when multiple retrieval sources are active, so a fixed-score-1.0 source does not dominate the score floor. **The default two-source ordering in effect today MUST be preserved** — the rule governs new multi-source configurations; any unavoidable ordering change at defaults MUST be recorded as an explicit before/after in `data-model.md`, never shipped silently. This is the single qualification on FR-007.
- **FR-006**: System MUST preserve capture duplicate-suppression behavior (threshold `0.86`) across the recall/write split, or record an explicitly accepted regression.
- **FR-007**: System MUST NOT change externally observable behavior in the default (all-enabled) configuration — this is a refactor.
- **FR-008**: Existing test suites (`KnowledgeMcpClientTest`, `LessonAutoCaptureTest`, `ContextBuilderTest`) MUST be **extended** to pin the new contract, not duplicated. (`ScopeInferenceTest` is unaffected — this refactor does not touch the capture extractor/scope-inference path.)
- **FR-009**: The change MUST be delivered as sequenced sub-changes (flag-split + config compatibility first; then dual-port split + per-bean conditional), serialized on the shared files (`RagProperties.kt`, `ContextBuilder.kt`, `application.yml`).

### Out of Scope

- Chat-generation decoupling from LightRAG (feature `016-fast-chat-streaming`).
- Implementing any new retrieval backend adapter (sqlite-vec / Chroma / mem0 / slim knowledge-api).
- Any off-disk repo change (agent-kit, personal-stack, ConfigMaps, fleet.yaml).

### Key Entities

- **RetrievalPort**: contract returning scored `Snippet(source, text, score)`; multiple beans coexist.
- **KnowledgeWritePort**: capture contract carrying scope, tags, confidence, and `findDuplicateEvidence`.
- **RagProperties**: the configuration surface being split.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Retrieval and capture can be toggled independently via configuration with zero code change, verified by tests for all four on/off combinations.
- **SC-002**: With all flags at their defaults, the full `:services:agents-api:check` suite passes with no behavioral diff (refactor is invisible to consumers).
- **SC-003**: Disabling the recall source removes it from the retrieval merge with no orphaned calls, verified by a `ContextBuilder` test.
- **SC-004**: Capturing a duplicate lesson is suppressed at the `0.86` threshold after the split, verified by an extended `LessonAutoCapture` test.
- **SC-005**: Exactly one `KnowledgeWritePort` bean exists after the split (no ambiguous-bean startup failure), verified by a context-load test.

## Assumptions

- `recallMode="deep"` reranking and the `minScore=0.3` floor semantics are owned by the off-disk knowledge-api; this refactor preserves the floor and defers re-calibration to the backend-swap feature.
- The deprecated `rag.enabled` master toggle is acceptable to remove one release after this ships.
