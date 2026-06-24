# Research — GitHub App-only repository access

All findings validated against the codebase in this worktree (constitution II).

## R1. Install-status probe without minting a token

**Question**: How to tell, live, whether the App can access a repo — without
issuing an access token?

**Finding**: `GitHubAppInstallationTokenClient.mint()` already performs the exact
lookup we need as its first step:

- `appJwt()` builds an RS256 App JWT (~9 min) from `githubAppId` +
  `githubAppPrivateKey`.
- `installationId(base, slug, jwt)` calls
  `GET /repos/{owner}/{repo}/installation` with `Authorization: Bearer <jwt>`.
  - **200** → an installation exists that includes this repo → **INSTALLED**
    (the App can access the repo).
  - **404** → no installation for the owner, or the installation does not
    include this repo → **NOT_INSTALLED** (treated as one user-facing state;
    the install link covers both "install on owner" and "add repo to
    installation").
  - **401 / 403 / 5xx / network / disabled App** → **UNKNOWN** (indeterminate).

`mint()` only continues to `accessToken(...)` after this; the status check stops
at the lookup, so **no token is minted or returned**.

**Decision**: Extract the JWT + installation lookup into a reusable method (e.g.
`installationStatus(repoUrl): InstallationState`) on the existing client, and add
a thin `RepositoryInstallationStatusService` in the application layer that the
controller calls. The App-enabled guard (`githubAppId`/`githubAppPrivateKey`
present) maps to UNKNOWN/disabled when absent, mirroring the existing
`InternalGitHubTokenController` 503 behavior.

**Rationale**: Reuses proven, already-deployed code; one GitHub round-trip; no
new secret handling.

## R2. Primary-repo clone over HTTPS

**Question**: Can the runner drop the SSH deploy key for the primary repo?

**Finding** (`services/agent-runner/entrypoint.sh`):

- Additional repos (`REPO_URLS`) already clone over **HTTPS** authenticated by
  the `agent-gh-app` credential helper, explicitly "no per-repo deploy key
  needed" (the multi-repo clone block).
- The primary repo's boot clone (the `REPO_URL` block) still sets
  `GIT_SSH_COMMAND="ssh -i /tmp/agent-deploy-key ..."` and stages the key from
  the mounted Secret.
- `git config --global url.https://github.com/.insteadOf git@github.com:` (and
  the `ssh://` form) is configured immediately **after** the primary clone, and
  the credential helper + `GH_TOKEN`/App-token resolution is set up there too.
- `derive_repo_allow()` already builds `REPO_ALLOW` from `REPO_URL` **plus**
  `REPO_URLS`, so the primary repo is already in the helper's allow-list.

**Decision**: Reorder so the `insteadOf` rewrite, credential-helper config, and
App-token env are established **before** the primary clone, then clone the
primary repo with the same `clone_repo_into_workspace` path used for additional
repos. Remove `GIT_SSH_COMMAND`, the `/tmp/agent-deploy-key` staging, and the
`~/.ssh/known_hosts` copy. SSH-form `REPO_URL` values still work because
`insteadOf` rewrites them to HTTPS before the clone.

**Risk/mitigation**: If `insteadOf` is not active for the primary clone the
clone fails. Mitigation: this is exactly the config additional repos already
rely on; PR1's quickstart verifies a primary-repo session clones and pushes
before anything else is removed.

## R3. Schema & data lifecycle

**Finding** (Flyway migrations, latest is `V16`; new migration is `V17`):

- `github_links` (V8): `vault_key_path TEXT NOT NULL`, `deploy_key_fingerprint`,
  `deploy_key_added_at`. Legacy project-scoped links; kept **read-only**.
- `repositories` (V9): `vault_key_path TEXT NOT NULL`,
  `deploy_key_fingerprint`, `deploy_key_added_at`.
- `repositories` verification (V11): `verify_read`, `verify_write`,
  `verify_default_branch_protected`, `verify_checked_at`, `verify_messages`.

**Decision** for `V17__drop_deploy_keys.sql`:

- Drop on `repositories`: `vault_key_path`, `deploy_key_fingerprint`,
  `deploy_key_added_at`, `verify_read`, `verify_write`.
- **Keep** on `repositories`: `verify_default_branch_protected`,
  `verify_checked_at` (branch-protection signal retained, FR-016), and
  `verify_messages` (repurposed for branch-protection messaging).
- Drop on `github_links`: `vault_key_path`, `deploy_key_fingerprint`,
  `deploy_key_added_at`.
- jOOQ codegen uses an H2 DDL simulator; `ALTER TABLE ... DROP COLUMN` is
  supported. Regenerate jOOQ classes as part of the build.

**Vault secret deletion** (FR-009): best-effort delete of
`secret/data/agents/repositories/<id>` and legacy
`secret/data/agents/projects/<projectId>/repos/<linkId>`. The secret store is
not a transactional participant, so deletion is a best-effort step (logged on
failure) run alongside the migration, **not** inside the SQL migration. The
column drop is the authoritative "no longer used" signal regardless of whether
every secret delete succeeds. Tasks choose between a one-time startup/admin
routine and a documented manual command.

## R4. Contract regeneration chain

**Finding**: `services/agents-api/openapi.json` is committed; the
`Pipeline Complete` required check includes an OpenAPI contract-drift gate.
`agents-ui` types (`features/repositories/types/index.ts`, etc.) are
`components['schemas'][...]` generated from that contract.

**Decision**: Any endpoint/DTO change must run
`./gradlew :services:agents-api:exportOpenApiSpec`, commit the regenerated
`openapi.json`, then regenerate UI types before touching UI code. (Per prior KB
lessons, `exportOpenApiSpec` needs GitHub Packages credentials to resolve
private Gradle convention plugins — ensure `GITHUB_ACTOR`/`GITHUB_TOKEN` are
present in the build environment.)

## Open risks carried into tasks

- **Vault deletion mechanism** (startup hook vs documented manual command) —
  decided during tasks; does not affect the column drop.
- **Permission-approval messaging** (FR-014) — surfaced via existing
  `warnOnNarrowedGrant` server-side; UI note already exists in `GitHubAppPanel`.
