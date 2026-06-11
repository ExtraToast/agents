# ExtraToast/agents — initiative plan

The home for the agent stack, extracted from `personal-stack`. This file is the
cold-start handoff; the authoritative detail lives in the Spec Kit specs under
`specs/`.

## Mission

Stand up `ExtraToast/agents` as a standalone, released repo for the agent stack,
rename the legacy "assistant" naming to "agents", give sessions durability
(restart with full history under an updated setup), and redesign the agents view
into a modern agent console.

## Components (moving in from personal-stack)

- **agents-api** — was `services/assistant-api` (JVM/Spring: sessions, workspaces,
  RAG, gateway orchestration, streaming chat).
- **agents-ui** — was `services/assistant-ui` (Vue 3 + PrimeVue + Tailwind +
  `@extratoast/vue-web-commons`).
- **agent-gateway** — in-pod JVM service owning the tmux PTY + byte-offset log
  tailer.
- **agent-runner** — the container image the agent runs in (CLIs, MCP, token
  helpers).

## Specs (source of truth — keep current)

1. `specs/001-extract-rename-agent-stack` — scaffold from `repo-template`,
   move + rename the four components, reuse shared libs / `github-workflows`
   reusable workflows / release-please versioning, and rewire `personal-stack` to
   consume released `agents` images. **Lands first.**
2. `specs/002-session-persistence-restart` — durable, PVC-backed transcript keyed
   by a stable session id; restart the runner (updated setup) and replay full
   history (builds on the gateway tmux log + offset/epoch).
3. `specs/003-agents-ui-redesign` — modern agent console: session list + live
   status + first-class terminal + "restart & continue" controls, on the current
   Vue stack.

Sequencing: 001 → (002 ‖ 003 can proceed in parallel once 001 lands; 003 consumes
002's restart/replay capability at the UI layer).

## Working model (keep doing this)

- **Codex implements; the orchestrator (Claude) does git/CI/network.** Dispatch
  `codex exec -m gpt-5.5 -c model_reasoning_effort=high -s workspace-write
  --skip-git-repo-check` workers in isolated worktrees (codex can't push/gh/gradle-
  fetch/npm-registry; the orchestrator commits/pushes/PRs/merges and verifies via
  CI). One worker per working tree.
- **Spec Kit throughout**: each workstream gets its spec (`/speckit.specify`),
  then plan (`/speckit.plan`), then tasks, then implementation. Keep specs updated
  as scope changes.
- **Scaffold from the latest `repo-template`**; reuse `ExtraToast/github-workflows`
  composite actions + reusable workflows; version with release-please; consume
  shared libs (`gradle-conventions`, `kotlin-spring-commons`, `vue-web-commons`,
  `openapi-client-gradle`) and the platform toolkit
  (`@extratoast/deploy-config-schema`) by published version — no path refs back to
  `personal-stack`.
- **Small stacked PRs**, each independently green; the only required check is the
  `Pipeline Complete` aggregator.

## Verification notes

- The agent sandbox can't auth to GitHub Packages (Maven/npm) — gradle/openapi/
  toolkit-render steps are verified via CI, not locally; UI checks run locally
  with the shared node_modules symlinked. (See personal-stack memory
  `sandbox-github-packages-auth-wall`.)
