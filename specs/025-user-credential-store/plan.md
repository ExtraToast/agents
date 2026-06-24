# Implementation Plan: User-scoped agent credential store

## Architecture decision

Storage moves from Vault to the agents Postgres (`agents_db`), owned by `agents-api`. The `agents-login` worker stays the capture authority (it runs `setup-token`) but stops writing Vault; instead it hands the captured payload to `agents-api`, which persists it per user. The runner is fed the **workspace owner's** credential at provision time, mirroring the existing per-workspace deploy-key Secret pattern.

## Components & changes

### agents-api (agents repo)

1. **Schema** — Flyway migration `agent_oauth_credentials`:
   `user_id text`, `provider text` (`CLAUDE`|`CODEX`), `payload jsonb` (provider fields), `valid boolean`, `validated_at timestamptz`, `updated_at`, `updated_by`, PK `(user_id, provider)`.
2. **Domain/port** — `AgentCredentialStore` port + jOOQ adapter: `upsert(userId, provider, payload)`, `find(userId, provider)`, `status(userId)`.
3. **Ingest** — internal endpoint `POST /api/v1/internal/credentials` (bearer-guarded, skips forward-auth) called by the worker on capture with `{userId, provider, payload}`; persists + triggers the validity probe. `CredentialController.storedStatus` now reads Postgres for the caller's `X-User-Id` (not Vault).
4. **Validity probe** — `CredentialValidator`: one provider call (Claude Messages API `/v1/messages` with `Authorization: Bearer <oauth_token>`, `max_tokens` tiny; Codex equivalent) → sets `valid`/`validated_at`. Failure surfaces "re-login needed", never throws into the request path.
5. **Workspace owner** — add `owner_user_id` to the workspace (migration + model); `WorkspaceController` create sets it from `X-User-Id`. Legacy rows null → no injection.
6. **Injection** — `Fabric8AgentRunnerOrchestrator`: resolve `owner_user_id` → `AgentCredentialStore.find` → stamp a per-workspace Secret `agent-runner-credentials-<short>` (Claude `oauth_token`, Codex `auth.json`/`config.toml`); mount `CLAUDE_CODE_OAUTH_TOKEN` (and Codex files). Replaces `claudeOauthEnv`'s dependency on the cluster-wide `agents-claude-oauth`. Cleaned up in `destroy()`. Best-effort: absent credential → no env, runner still starts.

### agent-runner (agents repo)

7. **entrypoint.sh** — on boot, if `CLAUDE_CODE_OAUTH_TOKEN` is set, (re)write the file Claude actually reads (`~/.claude/.credentials.json` claudeAiOauth shape) from it, so a stale credential persisted on the workspace volume can never win. Same idea for Codex `auth.json` from the injected file. Idempotent; no-op when unset.

### agents-login worker (personal-stack-2)

8. Replace the Vault write (`vaultClient` + `captureClaude`/`captureCodex` → Vault) with a POST to `agents-api` `/api/v1/internal/credentials` (in-cluster, bearer). `storedStatus` likewise delegates to agents-api. Keep the capture/parse logic (OSC8, `parseClaudeToken`) unchanged. Drop `vaultClient` and the Vault env/role.
9. Fix capture robustness: ensure a real token is parsed before reporting success (FR-005); surface the parse failure reason.

### platform / Flux (personal-stack-2)

10. Remove `platform/cluster/flux/apps/agents/credentials/{claude,codex}-oauth-vss.yaml` + their kustomization entries; remove the `agents/claude-oauth` / `agents/codex-oauth` paths from `bootstrap-auth.sh` policies; drop the now-unused `agents-oauth-writer` role and the worker's Vault role/env. Update SETUP/README/AGENT-PARITY docs. Re-run render + platform tests.

## Contracts

- `POST /api/v1/internal/credentials` (bearer): body `{userId, provider, payload}` → 204. Documented in openapi.json; no browser exposure.
- `GET /api/v1/credentials/status` → per-provider `{stored, valid, updatedAt}` for `X-User-Id`. Regenerate openapi.json + agents-ui generated.ts.

## Testing

- agents-api: store upsert/find/status; ingest endpoint persists + probes; validator maps 200→valid, 401→invalid; injection stamps the per-workspace Secret from the owner's credential and skips cleanly when absent; owner set on create. ≥80% jacoco; integration test for the orchestrator Secret stamping.
- worker: capture posts to agents-api with the parsed token; no-token path fails loudly; status delegates.
- platform: `node --test` green after VSS/policy removal; render diff clean; kustomize builds.
- Live: a real login lands a row in Postgres; a fresh runner authenticates (probe); re-login + upgrade uses the new token; Vault paths gone.

## Constitution compliance

Small stacked PRs (schema+store, ingest+validator, owner+injection, runner entrypoint, worker, Vault removal). Secrets never logged or returned. Claude/Codex parity. No backwards-compat shim for the Vault path — clean delete once Postgres is live.
