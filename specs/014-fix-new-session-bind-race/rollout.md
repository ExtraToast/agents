# Rollout: fix new-session bind race (spec 014)

## Live pod state

**Cluster**: `agents.jorisjonkers.dev`  
**Expected image**: `ghcr.io/extratoast/agents/agents-api:v0.7.0`

> **Note**: direct pod-digest query via Kubernetes MCP was not available in this
> session; the expected tag is derived from release history below. Confirm with
> `kubectl -n agents get pod -l app=agents-api -o jsonpath='{..image}'` before
> cutting the release.

The release workflow (`release.yml:92`) publishes images only on a
release-please tag or `workflow_dispatch`. CI (`ci.yml:127`) builds with
`push: false`. No image has been published to GHCR since `v0.7.0`
(2026-06-16, `377b7f9`), so the cluster is running `v0.7.0` unless a manual
`workflow_dispatch` was triggered.

---

## Gap between v0.7.0 and origin/main@02110db

Two `fix:` commits landed on `main` after `v0.7.0` without a release being
cut:

| SHA | Date | Subject |
|---|---|---|
| `9898436` | 2026-06-17 | `fix(agents-ui): re-fit terminal when console layout changes (#50)` |
| `02110db` | 2026-06-17 | `Repair session-generation conflicts: workspace-owned runner boot, bind-only sessions (#51)` |

**Gap**: both fixes are running unreleased in the live cluster (via
`:latest` / manual publish, or not at all if the cluster is still pinned to
`v0.7.0`). The spec 014 fix targets the remaining new-session 409 race that
persists on top of `02110db`.

---

## Expected next release

`.release-please-manifest.json` tracks version `0.7.0`. Since v0.7.0 only
`fix:` and `fix(scope):` commits have landed (no `feat:` or breaking change),
release-please will propose **`v0.7.1`** as the next patch release.

---

## Rollout steps

### 1 — Merge the spec 014 PR

Merge the PR that carries the spec 014 fix to `main`. The commit must follow
conventional-commit format (`fix:` or `fix(agents-api):`) so release-please
picks it up.

### 2 — Release-please opens release PR automatically

`release.yml` runs on every push to `main`. The release-please step opens or
updates a release PR titled `chore(main): release 0.7.1`. No manual changelog
or version editing is required.

- If the PR is not opened within a few minutes, check the `Release` workflow
  run in GitHub Actions for errors (token fallback, App permissions).

### 3 — Review and merge the release PR

A maintainer reviews the auto-generated CHANGELOG entry and merges the release
PR. Branch protection requires CI to pass on the release-please PR before it
can be merged (the release-please App token ensures CI is triggered; see
`release.yml:36–47`).

**Owner**: `jorisjonkers@nedap.com` (repo maintainer) — no other action is
needed beyond approving and merging the PR.

### 4 — Release workflow publishes images

Merging the release PR triggers `release.yml` again. The
`publish-images` job pushes:

```
ghcr.io/extratoast/agents/agents-api:v0.7.1
ghcr.io/extratoast/agents/agents-api:latest
```

(and likewise for `agents-ui`, `agent-gateway`, `agent-runner`).

Confirm all four images are present in GHCR before updating `personal-stack`.

### 5 — Bump personal-stack manifests

In the `personal-stack` GitOps repository, update the `agents-api` image tag:

```
ghcr.io/extratoast/agents/agents-api:v0.7.0  →  ghcr.io/extratoast/agents/agents-api:v0.7.1
```

Repeat for any other component image tags pinned to `v0.7.0`.

Per spec 004 (section 220–222) and `FR-008`, manifests must pin the released
tag. Do not rely on `:latest`.

Renovate will propose this bump automatically once the new GHCR tag is
visible; alternatively, update the manifest by hand and open a PR in
`personal-stack`.

### 6 — Flux reconciles

After the `personal-stack` manifest PR is merged, Flux detects the changed
image tag on its next sync interval and rolls the `agents-api` deployment.
Verify the new pod pulls `v0.7.1` and becomes `Running`.

---

## Flags / open items

- **Unreleased main commits**: `9898436` and `02110db` have been on `main`
  since 2026-06-17 with no release cut. If the cluster is pinned to `v0.7.0`,
  those fixes have not reached production yet. The `v0.7.1` release will
  bundle them all.
- **Live pod digest unconfirmed**: Kubernetes MCP access was unavailable;
  verify the running image tag before declaring rollout complete.
- **Release-please manifest clarification** (spec 004 FR-003): the manifest
  records `0.7.0`; the intended next tag `v0.7.1` is consistent with that
  baseline. The open question about `v0.1.0` in spec 004 is no longer
  relevant — the project is already past `v0.7.0`.
- **Release cut owner**: the maintainer (`jorisjonkers@nedap.com`) is the sole
  actor who needs to merge the release-please PR; all other steps are
  automated.
