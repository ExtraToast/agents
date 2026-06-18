# Quickstart — verify fast chat streaming locally

1. Run agents-api and agent-gateway locally (see repo RUNNER/REPO_SETUP docs).
2. Create a chat session (`PLAIN` and one `KNOWLEDGE`).
3. Send a message; observe `chunk` SSE events begin within the first-token budget (SC-001) and stream incrementally.
4. Send a follow-up that depends on the prior turn; confirm the answer uses history (SC-002).
5. Confirm no request hits LightRAG `/query/stream` (SC-003) — check logs / network.
6. For the `KNOWLEDGE` session, confirm retrieved snippets inform the answer; for `PLAIN`, none are injected (SC-004).
