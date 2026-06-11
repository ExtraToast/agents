# Contributing (ExtraToast conventions)

These conventions follow the standard ExtraToast repo shape for the agents stack.

## Branch & PR flow

- Branch from `main`. Keep PRs small, reviewable, and revertable alone;
  stacking (PR B on PR A) is fine.
- Open a PR using the template. **Every PR links its tracking issue / epic.**
- Merge method is **squash only** (enforced by the ruleset), and history is
  linear. Use a conventional-commit PR title — release-please derives the next
  version from it.
- A PR merges only when the single required check, **`Pipeline Complete`**, is
  green.

## CI: one pipeline, one gate

Each repo has exactly one CI workflow whose terminal job is named **`Pipeline
Complete`**. It `needs:` every gating job and fails unless all of them
succeeded. The org ruleset requires only that one check, so adding/renaming a
job never touches branch protection — just keep it in the aggregator's
`needs:`. See `.github/workflows/ci.yml`.

Coverage and quality gates run through the JVM and UI jobs in `.github/workflows/ci.yml`.

## Versioning

Exact-pin everything; release via release-please. Full rules in
`VERSIONING.md`.

## Publishing

New GitHub Packages publish as public on this account. Verify package visibility
after the first publish.

## Commit & PR voice

Impersonal and professional. No `you`/`we`; lead with the observable behaviour
or root cause, then the change. No hedging ("hopefully", "should be fine"); say
what proves it works. Do not add co-author or generated-by trailers.

## Tracking work

Work is tracked as issues under a milestone, rolled up to an epic issue. Keep
the issue checklist and status current as PRs land, and reference issues from
PRs (`Closes #`, `Part of #`).
