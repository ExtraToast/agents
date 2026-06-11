# Agents Plan

This repo owns the standalone agents stack and its release pipeline.

## Components

- `agents-api`: Spring/Kotlin API for sessions, workspaces, repository access, RAG, streaming chat, and runner orchestration.
- `agents-ui`: Vue 3 UI using PrimeVue, Tailwind, and `@extratoast/vue-web-commons`.
- `agent-gateway`: JVM service inside runner pods, owning tmux, terminal attach, logs, and local Git operations.
- `agent-runner`: image with CLIs, MCP helpers, token helpers, language toolchains, and the gateway jar.

## Current Priorities

1. Keep the standalone build green for both JVM services and the UI.
2. Keep the OpenAPI contract gate local to this repo.
3. Publish versioned GHCR images from release-please releases.
4. Preserve the `ASSISTANT` chat/message role value as persisted domain data while product and service names use `agents`.

## Compatibility Notes

- Kotlin group root remains `com.jorisjonkers.personalstack`; only the final package segment is `agents`.
- No schema/table/column names contain the old product name, so no Flyway rename migration is needed.
- Runtime defaults use `agents` service names, hosts, node labels, image names, DB defaults, and Vault role names.
- Cutover environments with previously provisioned DB/user/Vault resources can either rename those resources externally or override the corresponding environment variables.
