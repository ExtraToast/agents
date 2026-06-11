# Bootstrapping a new ExtraToast repo from this template

1. **Create the repo from the template** (GitHub "Use this template", or
   `gh repo create ExtraToast/<name> --template ExtraToast/repo-template
   --private`).
2. **Apply the branch ruleset** so `Pipeline Complete` is required:
   ```bash
   scripts/apply-ruleset.sh ExtraToast/<name>
   ```
3. **Wire the real CI**: replace the placeholder `lint`/`test`/`coverage`/`build`
   jobs in `.github/workflows/ci.yml` with this repo's actual jobs (or calls
   into reusable workflows from `ExtraToast/github-workflows`). Keep the
   `pipeline-complete` aggregator and list every gating job in its `needs:`.
4. **Wire the coverage gate**: every repo must enforce **>=80% line coverage**.
   - Gradle: apply JaCoCo and run `jacocoTestCoverageVerification` with a line
     coverage minimum of `0.80`.
   - Node: run Vitest with c8 coverage enforcement, for example `c8 --lines 80
     vitest run`.
5. **Set the release artifact**: edit `release.yml`'s `publish` job for this
   repo's artifact type (Maven / npm / image), and set `release-type` in
   `release-please-config.json` accordingly. New GitHub Packages publish as
   public on this account, but verify package visibility after the first
   publish.
6. **Set the starting version** in `.release-please-manifest.json`.
7. **CODEOWNERS / README**: adjust owners and replace this README's body with
   the repo's purpose.
8. **Choose dependency policy depth**:
   - Keep the root `renovate.json` and `.github/dependabot.yml` for the default
     ExtraToast policy.
   - Copy richer stack-specific variants from `templates/dependency-policy/`
     when the repo needs Dependabot ecosystems, dependency-review, Scorecard, or
     advanced CodeQL setup.
9. **Choose root tooling presets** from `templates/root-tooling/` when the repo
   has frontend linting, local hooks, ADRs, or docs indexes.
10. **Opt into platform/deploy config validation** only for repos that carry
    platform config: copy
    `templates/platform-config-validation/platform-config-validate.yml.tmpl` to
    `.github/workflows/platform-config-validate.yml`. It calls
    `ExtraToast/github-workflows/.github/workflows/platform-config-validate.yml@main`
    with `schema-kind: auto` and platform/deploy YAML globs. Pin the reusable
    workflow ref to a release tag when one is available.
11. **Review Docker pattern skeletons** in `templates/docker-patterns/` only as
    design references. They are not production Dockerfiles.
12. **Validate template assets**:
    ```bash
    scripts/validate-templates.sh
    ```

## What this template provides

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | One CI pipeline ending in the `Pipeline Complete` gate, including a coverage gate placeholder |
| `.github/workflows/release.yml` | release-please tag/release + artifact publish |
| `.github/rulesets/main.json` + `scripts/apply-ruleset.sh` | Org ruleset as code (requires `Pipeline Complete`) |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR template (tracking + verification + versioning) |
| `.github/ISSUE_TEMPLATE/*` | Bug / feature / task forms |
| `.github/CODEOWNERS`, `dependabot.yml`, `renovate.json` | Ownership + dependency automation |
| `templates/dependency-policy/` | Parameterized Dependabot, Renovate, dependency-review, Scorecard, and CodeQL policy templates |
| `templates/root-tooling/` | Root editor, prettier, ESLint, lint-staged, Husky, gitleaks, docs, and ADR presets |
| `templates/platform-config-validation/` | Opt-in workflow template for `@extratoast/deploy-config-schema` validation |
| `templates/docker-patterns/` | Design-only Dockerfile and entrypoint skeleton fixtures |
| `scripts/validate-templates.sh` | Local validation for template syntax, policy invariants, and source-value leakage |
| `release-please-config.json`, `.release-please-manifest.json` | Versioning state |
| `CONTRIBUTING.md`, `VERSIONING.md`, `SECURITY.md` | Conventions |
| `.editorconfig`, `.gitignore`, `.gitleaks.toml`, `LICENSE` | Baseline hygiene |
