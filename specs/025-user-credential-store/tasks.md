# Tasks: User-scoped agent credential store

Stacked, each independently shippable. agents-api first, then runner, then worker + Vault removal (personal-stack-2).

## Phase A — agents-api: storage (FR-001/002)
- [ ] T001 Flyway migration `agent_oauth_credentials` (PK `(user_id, provider)`, `payload jsonb`, `valid`, `validated_at`, `updated_at`, `updated_by`).
- [ ] T002 `AgentCredentialStore` port + jOOQ adapter (`upsert`, `find`, `status`); unit + integration tests.

## Phase B — agents-api: ingest + validity (FR-005/006/007)
- [ ] T003 Internal `POST /api/v1/internal/credentials` (bearer-guarded) → upsert + probe; openapi.json.
- [ ] T004 `CredentialValidator` (provider API probe, bounded, never throws into request path); tests for valid/invalid mapping.
- [ ] T005 `CredentialController.storedStatus` + `GET /credentials/status` read Postgres for `X-User-Id`; regenerate openapi.json + agents-ui generated.ts.

## Phase C — agents-api: owner + injection (FR-003/004/009/010)
- [ ] T006 Migration + model: workspace `owner_user_id`; set from `X-User-Id` on create; legacy null.
- [ ] T007 `Fabric8AgentRunnerOrchestrator`: per-workspace credential Secret from the owner's stored credential; mount Claude/Codex env+files; clean up in `destroy()`; best-effort skip when absent. Remove dependence on cluster-wide `agents-claude-oauth`. Integration test.

## Phase D — agent-runner (FR-004)
- [ ] T008 `entrypoint.sh`: write `~/.claude/.credentials.json` from `CLAUDE_CODE_OAUTH_TOKEN` (and Codex `auth.json` from the injected file) at boot so a stale on-volume credential can't shadow the injected one. Idempotent; self-test line.

## Phase E — agents-login worker + Flux (personal-stack-2) (FR-001/008)
- [ ] T009 Worker: POST captured payload to agents-api `/internal/credentials` instead of Vault; `storedStatus` delegates; drop `vaultClient` + Vault role/env. Fix capture to require a parsed token (FR-005).
- [ ] T010 Remove `{claude,codex}-oauth-vss.yaml` + kustomization entries; drop `agents/claude-oauth|codex-oauth` from `bootstrap-auth.sh` + the `agents-oauth-writer` role; update docs. Re-render + `node --test`.

## Phase F — ship & verify
- [ ] T011 Stacked PRs (agents: A→D; personal-stack-2: E), CI green, release-please cut, Keel roll.
- [ ] T012 Live: real login → Postgres row; fresh runner authenticates (probe); re-login+upgrade uses new token; two-user isolation; Vault paths gone.
