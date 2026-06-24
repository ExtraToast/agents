# Quickstart — Validate GitHub App-only repository access

End-to-end manual validation and the per-area verification commands. Run from
the repo root.

## Per-area verification commands (constitution V)

- **agents-api (Kotlin)**: `./gradlew :services:agents-api:test --no-daemon`
- **Contract export / drift**: `./gradlew :services:agents-api:exportOpenApiSpec --no-daemon`
  then confirm `services/agents-api/openapi.json` matches (CI `Pipeline Complete`).
  > Needs GitHub Packages creds (`GITHUB_ACTOR`/`GITHUB_TOKEN`) to resolve
  > private Gradle convention plugins.
- **agents-ui**: `pnpm --filter agents-ui typecheck && pnpm --filter agents-ui lint && pnpm --filter agents-ui test`
  > UI dep install needs GitHub Packages auth for `@extratoast/vue-web-commons`.
- **agent-runner**: `sh -n services/agent-runner/entrypoint.sh` (syntax) plus the
  end-to-end session check below.

## End-to-end acceptance walkthrough

Maps to the spec's user stories and success criteria.

### US1 — Add a repo, no deploy key (P1)

1. In the UI, add a repository (name, repo URL, default branch). **Expect**: no
   field or step asks for an SSH/deploy key (SC-002).
2. Land on the repository detail screen. **Expect**: a working "Install the
   GitHub App on `<owner>`" link and the access-summary listing exactly the
   App's requested permissions (SC-005).
3. With the App installed on the owner, start an agent session against the repo.
   **Expect**: the runner clones, pushes a branch, opens a PR, and triggers
   Actions — with no deploy-key secret mounted (SC-001, SC-004).

### US2 — Live install status (P2)

1. For a repo whose owner has **not** installed the App: detail screen shows
   "App not installed — install" with the link (FR-004).
2. Install the App on GitHub, then click **Re-check**. **Expect**: status flips
   to "App installed / can access" without restarting a session (SC-003).
3. Temporarily point at an unreachable App config: **Expect** an explicit
   "could not determine" state with retry, never a false "installed" (edge case
   / FR-004).

### US3 — Cleanup + identity (P3)

1. Inspect a repository record (DB or API). **Expect**: no
   `deployKeyFingerprint` / `deployKeyAddedAt` / `vaultKeyPath`, and runner pods
   show no deploy-key volume (SC-004).
2. Follow every App link in the UI. **Expect**: all resolve to
   `jorisjonkers-dev-agents` (SC-005).
3. Confirm `git@github.com:owner/repo`-form repos still clone (SC-006): start a
   session for an SSH-URL repo and confirm clone/push succeed via the HTTPS
   `insteadOf` rewrite.

## Per-PR smoke (matches plan PR slices)

- **PR1**: deploy a runner from this branch, start a primary-repo session, watch
  the entrypoint log clone the primary repo over HTTPS (no `GIT_SSH_COMMAND`),
  push a commit. Confirm no `github-deploy-key` volume on the pod.
- **PR2**: hit `GET /repositories/{id}/installation-status` for an installed and
  a not-installed owner; confirm INSTALLED / NOT_INSTALLED and a parse-failure
  UNKNOWN; confirm UI shows live status + install link + re-check.
- **PR3**: confirm `POST /repositories/{id}/key` is gone (404), the attach
  wizard is removed, and `verify` returns branch-protection-only.
- **PR4**: run the migration on a copy of prod data; confirm columns dropped and
  existing repos/sessions still work; confirm Vault secrets best-effort deleted
  (or the documented manual command runs clean).
