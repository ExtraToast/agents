# Implementation Plan: Memory Seam Decoupling

**Branch**: `015-memory-seam-decoupling` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)
**Input**: Behavior-preserving refactor of the agents-api RAG retrieval/capture seam.

## Summary

Split the single `rag.enabled` flag into independent retrieval/capture flags, split the dual-port `KnowledgeMcpClient` into separate recall/write components, add per-`RetrievalPort`-bean conditionals plus a coexistence ranking rule, and preserve capture dedup parity — all without changing default behavior. This unblocks a later backend swap. Delivered as two serialized sub-changes on the shared files.

## Technical Context

**Language/Version**: Kotlin 2.x, Spring Boot.
**Primary Dependencies**: Spring `@ConfigurationProperties`, `@ConditionalOnProperty`, Micrometer.
**Storage**: N/A directly (knowledge-api is the backend behind the ports).
**Testing**: Gradle `:services:agents-api:check` (unit + integrationTest).
**Target Platform**: JVM service on k3s.
**Project Type**: service.
**Performance Goals**: N/A (refactor).
**Constraints**: zero observable behavior change at defaults; one `KnowledgeWritePort` bean; serialize edits to shared files.
**Scale/Scope**: internal refactor, single service.

## Constitution Check

- [x] No attribution introduced anywhere
- [x] Claude/Codex parity — N/A (server-side RAG, no agent-facing surface changes)
- [x] Rendered artifacts — N/A (no render-managed config; `application.yml` is in-repo)
- [x] Small stacked PR boundary — sub-change A (flags) then sub-change B (port split) are separate PRs; no unrelated cleanup
- [x] Verification command — `:services:agents-api:check`

## Project Structure

### Source Code

```text
services/agents-api/.../config/RagProperties.kt                  # flag split
services/agents-api/.../application/rag/ContextBuilder.kt         # read rag.retrieval.enabled; coexistence ranking
services/agents-api/.../application/rag/LessonAutoCapture.kt      # read rag.capture.enabled
services/agents-api/.../infrastructure/integration/KnowledgeMcpClient.kt  # split into recall + write
services/agents-api/.../infrastructure/integration/LightRagClient.kt      # add per-bean @ConditionalOnProperty
services/agents-api/.../domain/port/RetrievalPort.kt             # (RetrievalPort + KnowledgeWritePort live here)
services/agents-api/src/main/resources/application.yml           # rag.* config
services/agents-api/src/test/.../ + src/integrationTest/.../     # extend existing suites
```

**Structure Decision**: No new packages. Two new beans (`KnowledgeRecallClient`, `KnowledgeWriteClient`) replace the one dual-port `KnowledgeMcpClient`; the `RetrievalPort`/`KnowledgeWritePort` interfaces stay in `RetrievalPort.kt`.

## Phase 0: Outline & Research

No external unknowns — all mechanism facts verified in the spec's Context section. The only deferred item is `minScore` re-calibration, explicitly assigned to the later backend-swap feature, not here.

## Phase 1: Design

- **data-model.md**: the `rag.*` config surface before/after; the bean topology before/after; the coexistence ranking rule.
- No new contracts (internal refactor; `RetrievalPort.Snippet` shape unchanged).
- **quickstart.md**: toggle each flag locally and observe independent gating.

## Phase 2: Sequencing (two serialized sub-changes)

**Sub-change A — flag split + config compat (ships first).** Add `rag.retrieval.enabled` + `rag.capture.enabled`; rewire `ContextBuilder.kt:33` and `LessonAutoCapture.kt:48`; keep `rag.enabled` as deprecated master toggle (false ⇒ both off). Extend `ContextBuilderTest`, `LessonAutoCaptureTest`. Sole owner of `RagProperties.kt`/`application.yml` for this PR.

**Sub-change B — dual-port split + per-bean conditional + coexistence ranking.** Split `KnowledgeMcpClient` into `KnowledgeRecallClient`(`RetrievalPort`) + `KnowledgeWriteClient`(`KnowledgeWritePort`); add `@ConditionalOnProperty` to each `RetrievalPort` bean; add the documented ranking rule so the LightRAG score-1.0 blob doesn't dominate. Extend `KnowledgeMcpClientTest` (now split), `ContextBuilderTest`. Depends on A.

## Constitution Re-check (post-design)

Still compliant: two small stacked PRs, no behavior change at defaults, exactly one `KnowledgeWritePort` after B.

## Unresolved Risks

- **Ambiguous-bean failure**: if the dual-port split is done carelessly, Spring could see zero or two `KnowledgeWritePort` beans. Mitigation: SC-005 context-load test.
- **Coexistence ranking is a judgment call**: document the rule and pin it with a `ContextBuilder` test using a score-1.0 source + a genuinely-scored source.
- **`minScore` recalibration is OUT of scope** — only flagged so the backend-swap feature owns it.

**Readiness**: ready for `/speckit.tasks`.
