# Data Model — Memory Seam Decoupling

## Config surface (RagProperties)
| Property | Before | After |
|---|---|---|
| `rag.enabled` | gates retrieval AND capture | deprecated master toggle (false ⇒ both off), one release |
| `rag.retrieval.enabled` | — | gates `ContextBuilder` retrieval |
| `rag.capture.enabled` | — | gates `LessonAutoCapture` capture |
| per-source enable (e.g. `rag.sources.lightrag.enabled`, `rag.sources.knowledge.enabled`) | — | `@ConditionalOnProperty` on each `RetrievalPort` bean |

## Bean topology
| | Before | After |
|---|---|---|
| `KnowledgeMcpClient` | one `@Component`: `RetrievalPort` + `KnowledgeWritePort` | removed |
| `KnowledgeRecallClient` | — | `RetrievalPort` (conditional) |
| `KnowledgeWriteClient` | — | `KnowledgeWritePort` (the single write bean) |
| `LightRagClient` | `RetrievalPort` (unconditional) | `RetrievalPort` (conditional) |

## Coexistence ranking rule
When multiple `RetrievalPort` sources are active, the merge MUST NOT let a fixed-score-1.0 source (LightRAG blob) crowd out genuinely-scored snippets: apply per-source caps / documented precedence before the `minScore=0.3` floor + sort. Pinned by a `ContextBuilder` test.
