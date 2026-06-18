# Research — Fast Chat Streaming

## Q1. How is chat generated today, and why is it slow?

`ChatAnswerStreamService.generateAnswer` (`:44`) calls `LightRagClient.streamQuery(userBody)` and forwards each piece as a `chunk` SSE event. `streamQuery` (`LightRagClient.kt:73`) POSTs LightRAG `/query/stream` in `mode="mix"` — hybrid knowledge-graph + vector retrieval, then generation. First-token latency includes the full retrieval phase. Only `userBody` is sent; session history is never read (`:29` loads the session only to assert existence). **Conclusion**: slow (retrieval-before-first-token) and single-turn by construction.

## Q2. Does agents-api have any other generation backend?

No. Grep finds no Anthropic/OpenAI/Spring-AI dependency. `LightRagClient.streamQuery` is the sole generator. **Conclusion**: "stream from the model directly" requires choosing where the model lives.

## Q3. Where does the model already live, with credentials?

In the **agent-runner Pods**. agent-gateway drives them: WebSocket attach (`AgentAttachHandler`), tmux session control (`TmuxClient`), output tailing (`LogTailer`, `TranscriptStore`), and one-shot headless jobs (`HeadlessJobManager`). The Pods hold the agent (Claude/Codex) credential and MCP tools. agents-api already bridges runner output to the UI via `SessionAttachHandler` (WebSocket) and `WorkspaceRunnerEventsBroadcaster`. **Conclusion**: reuse the runner-Pod path — no new secret in agents-api (SC-006), and Claude/Codex parity is preserved because generation runs whatever agent the Pod is configured with.

## Q4. What is the streaming-transport gap?

Two distinct transports exist:
- **Chat**: HTTP `SseEmitter` (`ChatAnswerStreamService` -> `ChatSessionController`).
- **Agent sessions**: WebSocket attach -> agent-gateway tmux `LogTailer`.

`HttpAgentGatewayClient` is REST control-plane only (`spawnAgent`, `sendInput`, `agentIdle`, ...) — no token stream. So `016` must **bridge a runner headless-job token stream into the chat SSE emitter**. `HeadlessJobManager` is the natural generation primitive (run headless, stream stdout). **Open risk**: tmux `LogTailer` buffering may add latency; a direct headless stream channel may be needed (measured in Phase 2 PR 1).

## Q5. Does this depend on feature 015?

No hard dependency. 015 makes retrieval *sources* individually toggleable and splits the capture/recall flags; `016` consumes `RetrievalPort` for optional grounding, which works regardless. Shipping 015 first is preferred (cleaner flags) but not required. The two are independent stacked PRs.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Generation backend | agent-runner Pod via agent-gateway (headless job) | Reuses existing credential + MCP tools; the `ChatSessionKind.KNOWLEDGE` design already points here; no new secret. |
| In-API LLM client (Anthropic SDK) | REJECTED | Adds a credential + Claude-only path (breaks Codex parity), higher maintenance surface. |
| Grounding | Optional, keyed off `ChatSessionKind` (retrieve-then-prompt) | Preserves LightRAG's one real benefit without coupling generation to LightRAG. |
| History | Bounded window from `ChatMessageRepository` | Fixes single-turn; bound prevents context blow-up. |
| LightRAG `streamQuery` | Remove AFTER new path live (FR-006) | Chat must never be backend-less; allows a grounding-quality benchmark first. |
