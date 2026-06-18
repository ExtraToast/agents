# Contract — Chat SSE events (MUST be preserved)

The endpoint and event shape are unchanged so existing UI clients keep working.

| Event | Payload | When |
|---|---|---|
| `chunk` | `{ "text": "<token piece>" }` | each streamed generation piece |
| `done`  | `{ "messageId": "<uuid>" }` | answer complete + persisted |
| `error` | `{ "message": "<reason>", "retryable": true }` | terminal failure |

- Emitter timeout stays `120_000ms` (`ChatAnswerStreamService` companion).
- Completion semantics: `done` then `emitter.complete()`, or `error` then complete.
- The ONLY change is the source of `chunk` text: a runner-Pod headless job instead of `LightRagClient.streamQuery`. Clients observe no contract change (SC-005).
