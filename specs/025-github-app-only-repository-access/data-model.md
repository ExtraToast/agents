# Data Model — GitHub App-only repository access

## Repository (table `repositories`, domain `Repository.kt`)

**Removed**

| Field / column | Reason |
| --- | --- |
| `vault_key_path` (`vaultKeyPath`) | No deploy key stored anymore. |
| `deploy_key_fingerprint` (`deployKeyFingerprint`) | Deploy keys retired. |
| `deploy_key_added_at` (`deployKeyAddedAt`) | Deploy keys retired. |
| `verify_read` (`AccessVerification.read`) | Deploy-key read probe removed (FR-015). |
| `verify_write` (`AccessVerification.write`) | Deploy-key write probe removed (FR-015). |
| `isKeyAttached` (derived) | No key concept. |

**Retained / reshaped**

| Field / column | Note |
| --- | --- |
| `id`, `name`, `repo_url`, `default_branch`, `created_at`, `updated_at` | Unchanged. |
| `verify_default_branch_protected` | Branch-protection signal kept (FR-016). |
| `verify_checked_at` | When protection was last checked. |
| `verify_messages` | Repurposed: branch-protection messages only. |

`AccessVerification` becomes branch-protection-only:
`{ defaultBranchProtected: Boolean?, checkedAt: Instant?, messages: List<String> }`.

## GithubLink (legacy, table `github_links`, domain `GithubLink.kt`)

Kept **read-only** (FR-010). Workspaces may still reference a `github_link_id`.

**Removed**: `vault_key_path`, `deploy_key_fingerprint`, `deploy_key_added_at`,
and the derived `isKeyAttached`. No new key path is ever written.

## InstallationStatus (live value — NOT persisted)

Computed on demand from a GitHub App JWT lookup; never stored (spec: live, not
authoritative storage).

```
InstallationStatus {
  state: INSTALLED | NOT_INSTALLED | UNKNOWN
  owner: String?            # parsed from repo_url; null if unparseable
  installUrl: String?       # https://github.com/apps/jorisjonkers-dev-agents/installations/new?state=<owner>
                            # null when owner is unparseable
  checkedAt: Instant
  detail: String?           # optional human note (e.g. "App not configured")
}
```

State mapping (see research R1):

- `GET /repos/{owner}/{repo}/installation` → **200** = `INSTALLED`.
- **404** = `NOT_INSTALLED` (owner not installed OR repo excluded from
  installation — one user-facing state).
- App not configured / **401** / **403** / **5xx** / network = `UNKNOWN`.
- repo_url not parseable as a GitHub repo → `state = UNKNOWN`, `owner = null`,
  `installUrl = null`, `detail = "repository URL is not a GitHub repository"`.

## Repository status surface (UI aggregate)

What `AccessStatusBadge` renders, combining:

- **App access**: from `InstallationStatus.state`.
- **Branch protection**: from retained `verify_default_branch_protected`.

No deploy-key/read/write row is shown.

## GitHub App identity (config, `githubAppLinks.ts`)

- `DEFAULT_GITHUB_APP_SLUG`: `'extratoast-agents'` → **`'jorisjonkers-dev-agents'`**.
- Requested-permissions list synced to backend `REQUESTED_PERMISSIONS`:
  `contents:write`, `pull_requests:write`, `actions:write`, `issues:write`,
  `workflows:write`, `packages:read`.
- Install link: `https://github.com/apps/jorisjonkers-dev-agents/installations/new`
  with `state=<owner>`; manage link:
  `https://github.com/settings/apps/jorisjonkers-dev-agents/installations`.
