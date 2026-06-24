**Scope**

Finish specs 025-B through 025-E and spec 026. Do not redo Phase A of 025.

**Outcomes**

Captured Claude and Codex credentials are stored in Postgres per user/provider, validated best-effort, reported from Postgres, and injected into only the owning user's workspace runner. Vault is removed as the OAuth credential store. Runner boot makes injected credentials authoritative over stale volume state. The workspace pane no longer exposes unusable setup controls, shows runner update reconnecting as transient, refreshes runner version after rebind, and uses local Claude/Codex icons.

**Non-goals**

No app-level credential encryption, no new multi-tenant authorization model beyond X-User-Id scoping, no hand-edited release-please versions, no unrelated Vault cleanup, and no generated/assistant attribution.
