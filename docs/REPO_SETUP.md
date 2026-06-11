# Repo Setup

This repository has already been scaffolded from the ExtraToast template and now carries real agents CI, release, and dependency automation.

## Required Secrets

- `GITHUB_TOKEN` or a package token that can read `ExtraToast/gradle-conventions` and `ExtraToast/kotlin-spring-commons`.
- `NODE_AUTH_TOKEN` that can read `@extratoast/vue-web-commons` from GitHub Packages.

GitHub Actions uses the repository `GITHUB_TOKEN` for package reads and GHCR image publishing.

## Branch Protection

The only required status check is `Pipeline Complete`. It aggregates workflow lint, JVM checks, UI checks, OpenAPI contract drift, and Docker image builds.

## Release

`release.yml` runs release-please on `main`. When a release is created, it publishes the four GHCR images:

- `ghcr.io/extratoast/agents/agents-api`
- `ghcr.io/extratoast/agents/agents-ui`
- `ghcr.io/extratoast/agents/agent-gateway`
- `ghcr.io/extratoast/agents/agent-runner`
