# Feature Specification: User-scoped agent credential store

**Feature Branch**: `feat/user-credential-redesign`
**Created**: 2026-06-24
**Status**: Draft
**Input**: Agent runners never receive a freshly captured Claude/Codex login token. The token is stored in Vault and projected into a single cluster-wide Secret via VSO; the projection is currently broken (`empty response from Vault, path=secret/data/agents/claude-oauth`) and the runner's `CLAUDE_CODE_OAUTH_TOKEN` is an optional Secret ref that silently resolves to empty, so a re-login never reaches a runner — even on a fresh image. Tokens are also not user-specific. Move credential storage to Postgres keyed by the forward-auth user identity, fix capture, and inject the owning user's token per-workspace.

## Context (verified)

- Browser → `agents-api` `CredentialController` (`/api/v1/credentials/*`) relays login sessions to the `agents-login` worker (personal-stack-2 `services/agents-login`); the forward-auth `X-User-Id` is passed to the worker as `updatedBy`. The worker runs `claude setup-token` / Codex login, captures the credential, and **writes it to Vault** (`secret/agents/claude-oauth`, `secret/agents/codex-oauth`).
- A VaultStaticSecret (`platform/cluster/flux/apps/agents/credentials/{claude,codex}-oauth-vss.yaml`) projects the Vault `oauth_token` field into the cluster-wide Secrets `agents-claude-oauth` / `agents-codex-oauth`.
- `Fabric8AgentRunnerOrchestrator` mounts `CLAUDE_CODE_OAUTH_TOKEN` from `agents-claude-oauth` as an **optional** Secret ref; absent Secret → unset env → no token.
- Forward-auth identity is already available everywhere: Traefik injects `X-User-Id`, `SecurityConfig` requires it on `/api/v1/*` (except `/api/v1/internal/*`, which is bearer-guarded).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A captured login reaches that user's runners (Priority: P1)

As the operator, after I complete a Claude (or Codex) login through the portal, every runner I subsequently start — including one recycled onto a new image — authenticates with the token I just captured, without any manual step.

**Independent Test**: Complete a login as user U; start/recycle a workspace owned by U; the runner's agent authenticates with the freshly captured token (a token-validity probe succeeds).

**Acceptance Scenarios**:
1. **Given** user U has completed a Claude login, **When** U starts or upgrades a workspace runner, **Then** the runner receives U's current Claude token and the agent authenticates.
2. **Given** U re-logs in (rotating the token), **When** U upgrades the runner, **Then** the new runner uses the new token (a stale credential file on the workspace volume never shadows it).
3. **Given** U has never logged in, **When** U starts a runner, **Then** the runner starts normally with no token (no regression) and the UI shows the credential as not yet captured.

### User Story 2 - Tokens are per user (Priority: P1)

Each user's captured tokens are stored and injected independently, keyed by the forward-auth identity; one user's login never overwrites or leaks into another user's runners.

**Acceptance Scenarios**:
1. **Given** users U and V have each logged in, **When** each starts a workspace, **Then** each runner receives its own owner's token.
2. **Given** a workspace owned by U, **When** its runner is provisioned, **Then** the credential injected is U's, resolved from the workspace owner, not a global/shared value.

### User Story 3 - Capture actually persists a token (Priority: P1)

A completed `setup-token` capture results in a stored token for the user; a capture that produces no token fails loudly with a clear reason rather than silently storing nothing.

**Acceptance Scenarios**:
1. **Given** a completed Claude `setup-token` run, **When** capture finishes, **Then** the token is persisted for the user and reported as stored.
2. **Given** `setup-token` printed no parseable token, **When** capture runs, **Then** it reports a clear failure and stores nothing (no empty/garbage record).
3. **Given** a freshly captured token, **When** the portal reports completion, **Then** a token-validity probe (a single provider API call) confirms the token authenticates before it is marked usable.

### Edge Cases

- Postgres unreachable at capture time → capture reports a retryable failure; nothing partially stored.
- A workspace with no resolvable owner (legacy rows) → runner starts with no injected token (no regression); surfaced as "no credential".
- Token present but rejected by the provider (expired/revoked) → the validity probe marks it unusable and the UI prompts re-login; the runner still starts.
- Concurrent re-logins for the same user/provider → last-write-wins on the single per-user/provider row; no duplicate rows.
- The injected per-workspace credential Secret must be cleaned up with the workspace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Captured Claude/Codex credentials MUST be stored in Postgres keyed by `(user_id, provider)`, where `user_id` is the forward-auth `X-User-Id` of the login session. Vault MUST NOT be used for these tokens.
- **FR-002**: The credential payload MUST retain what each provider needs (Claude: the `setup-token` OAuth token; Codex: `auth.json` + `config.toml`) plus `updated_at` / `updated_by`.
- **FR-003**: A workspace MUST carry an owner user identity (set from `X-User-Id` at creation) so the runner can resolve whose credential to inject. Legacy workspaces without an owner inject no token.
- **FR-004**: At runner provision the system MUST resolve the workspace owner's current credential and inject it so the agent CLI uses it — without a stale on-volume credential file shadowing it.
- **FR-005**: Capture MUST fail loudly when no token is produced and MUST NOT persist an empty/partial record.
- **FR-006**: After a successful capture the system MUST verify the token authenticates with the provider (a single lightweight API call) and record validity; an invalid token is surfaced for re-login.
- **FR-007**: The portal/credential status MUST report, per provider for the current user, whether a usable token is stored and when it was last updated — sourced from Postgres, not Vault.
- **FR-008**: The Vault `claude-oauth` / `codex-oauth` VaultStaticSecrets, their projected cluster Secrets, and the Vault policy paths for them MUST be removed once Postgres storage is live.
- **FR-009**: Stored tokens are secrets: they MUST NOT be logged, MUST NOT be returned to the browser, and the per-workspace injection MUST be readable only by that workspace's runner.
- **FR-010**: Credential injection MUST be best-effort at provision: a storage read failure or absent credential MUST NOT block the runner from starting.

*Deferred / out of scope:* encryption-at-rest beyond Postgres' own (a follow-up may add app-level envelope encryption); multi-tenant authz beyond keying by `X-User-Id`; Codex token-refresh semantics.

### Key Entities

- **User credential**: per `(user_id, provider)` record holding the provider payload + validity + timestamps.
- **Workspace owner**: the `X-User-Id` that created the workspace; selects whose credential the runner gets.
- **Injected runner credential**: the per-workspace projection (env + on-volume file) the agent CLI reads.

## Success Criteria *(mandatory)*

- **SC-001**: After a fresh login, 100% of newly provisioned runners for that user authenticate with the captured token (token-validity probe passes).
- **SC-002**: A re-login followed by a runner upgrade results in the new token being used — verified by the probe — with no manual volume edit.
- **SC-003**: Two distinct users' tokens never cross: each runner authenticates as its workspace owner.
- **SC-004**: A capture that yields no token reports a clear error and leaves no stored record.
- **SC-005**: No agent token is present in Vault after the migration; the removed VSS/Secrets/policy no longer exist and nothing depends on them.
- **SC-006**: No token value appears in any log line or any browser-facing response.
