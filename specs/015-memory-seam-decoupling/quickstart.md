# Quickstart — verify the seam decoupling

1. `./gradlew :services:agents-api:check` — all green at defaults (no behavior change).
2. Set `rag.retrieval.enabled=false`, `rag.capture.enabled=true`; boot; confirm no `<context>` envelope, capture still writes.
3. Invert the flags; confirm the opposite.
4. Set `rag.enabled=false`; confirm both disabled (rollback).
5. Disable the knowledge recall source; confirm `ContextBuilder` no longer queries it and only the remaining source contributes.
6. Capture the same lesson twice; confirm the second is suppressed at 0.86.
