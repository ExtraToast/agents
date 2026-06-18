# Data Model — Fast Chat Streaming

## Conversation history window
- Source: `ChatMessageRepository` (jOOQ `chat_session_messages`), ordered by `created_at`.
- Window: most-recent N turns OR M characters (documented bound), always including the latest user turn.
- Supplied to the generation request as prior context.

## ChatSessionKind routing
| Kind | Retrieval (grounding) | Generation |
|---|---|---|
| `PLAIN` | none | runner-Pod headless job |
| `KNOWLEDGE` | `RetrievalPort` retrieve-then-prompt | runner-Pod headless job |

Neither kind calls `LightRagClient.streamQuery`.

## Persistence
- Assistant answer appended via `AppendChatMessageCommand` (unchanged), role `ASSISTANT`.
