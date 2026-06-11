# ExtraToast/agents

Standalone agent stack for `jorisjonkers.dev`.

## Components

- `services/agents-api` - Spring/Kotlin API for workspaces, sessions, repository access, RAG, and runner orchestration.
- `services/agents-ui` - Vue UI published as `@extratoast/agents-ui`.
- `services/agent-gateway` - in-pod gateway for tmux, logs, Git checks, and terminal WebSockets.
- `services/agent-runner` - runner image with the agent CLIs, tools, and gateway jar.

## Build

JVM services use published ExtraToast Gradle conventions and Kotlin commons from GitHub Packages:

```bash
./gradlew :services:agents-api:check :services:agent-gateway:check
./gradlew :services:agents-api:bootJar :services:agent-gateway:bootJar
```

The UI uses pnpm and GitHub Packages for `@extratoast/vue-web-commons`:

```bash
corepack pnpm install
corepack pnpm --filter @extratoast/agents-ui lint
corepack pnpm --filter @extratoast/agents-ui test
corepack pnpm --filter @extratoast/agents-ui build
```

Set `GITHUB_ACTOR`/`GITHUB_TOKEN` for Gradle package resolution and `NODE_AUTH_TOKEN` for npm package resolution.

## Contracts

The OpenAPI contract lives inside this repo:

```bash
./gradlew :services:agents-api:exportOpenApiSpec
corepack pnpm --filter @extratoast/agents-ui contract:generate
```

CI verifies the committed `services/agents-api/openapi.json` and `services/agents-ui/src/api/generated.ts` do not drift.

## Images

Release automation publishes:

- `ghcr.io/extratoast/agents/agents-api`
- `ghcr.io/extratoast/agents/agents-ui`
- `ghcr.io/extratoast/agents/agent-gateway`
- `ghcr.io/extratoast/agents/agent-runner`

No database schema/table/column names contain the old product name, so no Flyway rename migration is needed. Operational defaults now use `agents` names; deployments that already provisioned old DB/user/Vault resources must migrate or override those values during cutover.
