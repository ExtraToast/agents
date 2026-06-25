# API Contract Changes — repositories

Authoritative contract is `services/agents-api/openapi.json`, regenerated via
`./gradlew :services:agents-api:exportOpenApiSpec`. This file describes the
intended deltas; the regenerated JSON is the source of truth the UI types build
from.

## Removed

- **`POST /api/v1/repositories/{id}/key`** — deploy-key attach. Removed entirely.
  - Request DTO `AttachRepositoryDeployKeyRequest` (privateKeyOpenssh,
    publicKeyOpenssh, knownHosts) deleted.
- **Legacy project GithubLink deploy-key endpoint(s)** on `ProjectController`
  (the `AttachDeployKey` path) — removed.

## Changed

- **`GET /api/v1/repositories`** and **`GET /api/v1/repositories/{id}`**
  - `RepositoryResponse` drops `deployKeyFingerprint`, `deployKeyAddedAt`,
    `vaultKeyPath`, `isKeyAttached`, and the `verify.read` / `verify.write`
    fields.
  - `verify` retained as branch-protection-only:
    `{ defaultBranchProtected, checkedAt, messages }`.
  - `GET /{id}` detail response MAY include a live `installationStatus` object
    (see below); if computed inline it is best-effort and may be `UNKNOWN`.

- **`POST /api/v1/repositories/{id}/verify`** (re-check)
  - Semantics change: re-check now refreshes **branch protection only**,
    returning the updated `RepositoryResponse`. No deploy-key probe is performed.
    Live install-status is exposed separately by the GET endpoint below (M2).

## Added

- **`GET /api/v1/repositories/{id}/installation-status`**
  - Returns the live install-status without minting a token (FR-004, FR-005).
    **This single GET is used both on screen load and by the manual "Re-check"
    button** (M2) — re-check just re-calls it.
  - 200 body:

    ```json
    {
      "state": "INSTALLED | NOT_INSTALLED | UNKNOWN",
      "owner": "jorisjonkers",
      "installUrl": "https://github.com/apps/jorisjonkers-dev-agents/installations/new?state=jorisjonkers",
      "checkedAt": "2026-06-24T12:00:00Z",
      "detail": null
    }
    ```

  - `owner`/`installUrl` are `null` when the repo URL is not a parseable GitHub
    repo (`state = UNKNOWN`, `detail` explains).
  - When the App is not configured server-side, `state = UNKNOWN` with a
    `detail` note (consistent with the internal token endpoint's disabled
    behavior). Never returns key material or a token.

## Internal (unchanged)

- `POST /api/v1/internal/github/installation-token` (in-cluster, runner-only) —
  unchanged. Still mints repo-scoped tokens for the runner credential helper.
