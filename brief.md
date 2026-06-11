# Council brief — complete spec 001 (extract & rename the agent stack)

Authoritative spec: `specs/001-extract-rename-agent-stack/spec.md`. Read it first.
This brief covers the **rename + rewire-to-standalone** execution on the already-
present substrate (the four services + repo-template scaffold + a raw copy of the
personal-stack root Gradle/pnpm build are committed but pre-rename, pre-trim,
non-building).

## Definition of done

The `ExtraToast/agents` repo builds and tests all four components **standalone**
(no reference to `personal-stack`), with consistent "agents" naming, reusing the
shared libs + `ExtraToast/github-workflows` reusable workflows + release-please.

## Tasks (decompose/parallelize as the DAG sees fit)

1. **Rename directories + service naming.**
   - `services/assistant-api` → `services/agents-api`; `services/assistant-ui` →
     `services/agents-ui`. Keep `services/agent-gateway`, `services/agent-runner`.
   - Rename all product/service identifiers "assistant" → "agents": image names,
     k8s Deployment/Service names, the public host, the API base path
     (`/api/v1/...` stays; any "assistant" in routes/hosts/labels → "agents"),
     Spring `spring.application.name` / config-property prefixes, gradle project
     names, npm package name (`@personal-stack/assistant-ui` →
     `@agents/agents-ui` or similar — match the repo's chosen scope).
   - In `agents-api` Kotlin, rename the `...personalstack.assistant` package
     segment to `...personalstack.agents` (keep the `com.jorisjonkers.personalstack`
     group for now to bound scope; note a follow-up to re-namespace). Update all
     imports/usages. `agent-gateway` is already `...agentgateway` — leave it.
   - Update DB schema/table/column or config-key names ONLY where they literally
     contain "assistant"; for any such rename, add a Flyway migration (rename, not
     drop) so existing data survives (FR-007). If none contain "assistant", note
     that no migration is needed.

2. **Standalone Gradle build.**
   - `settings.gradle.kts`: include only `:services:agents-api` and
     `:services:agent-gateway`; remove `auth-api`, `knowledge-api`,
     `platform:tooling`, `system-tests`, etc. Keep the `pluginManagement` +
     `dependencyResolutionManagement` GitHub Packages repos for
     `gradle-conventions` (`dev.extratoast.*` plugins) and `kotlin-spring-commons`
     (consumed by published version, via `gpr.user`/`gpr.token` or
     `GITHUB_ACTOR`/`GITHUB_TOKEN` — keep that pattern).
   - Root `build.gradle.kts`, `gradle.properties`: trim to what the two JVM
     services need; keep shared-lib versions.
   - Verify each service `build.gradle.kts` references only published shared libs
     (no `:platform:tooling` or sibling-project deps). If `agents-api` had a
     project dependency on a removed module, replace with the published artifact
     or remove if unused.

3. **Standalone UI build.**
   - `pnpm-workspace.yaml`: `services/agents-ui` (+ a system-tests package only if
     you also move e2e; otherwise omit). Root `package.json`: trim scripts to the
     agents UI. Keep `@extratoast/vue-web-commons` (published).
   - Update `agents-ui` package name, `VITE_*` envs, and any "assistant" strings.

4. **CI + release + docker.**
   - Replace the repo-template placeholder `lint`/`test`/`coverage`/`build` jobs in
     `.github/workflows/ci.yml` with real jobs that lint+test+build the two JVM
     services, the UI (typecheck+lint+vitest), and build the docker images for
     agents-api, agents-ui, agent-gateway, agent-runner. Call
     `ExtraToast/github-workflows` reusable workflows/composite actions where one
     fits. ALWAYS keep the final `pipeline-complete` aggregator with every gating
     job in its `needs:`.
   - Keep the OpenAPI contract gate (spec ↔ generated TS types) within this repo,
     adapting paths to `agents-api`/`agents-ui`.
   - `release-please-config.json` / `.release-please-manifest.json`: configure for
     this repo (single repo version is fine; or per-component if straightforward).
   - Adapt each service Dockerfile to the new names/paths; reuse the
     `templates/docker-patterns/*` patterns already in the repo.

## Constraints
- Do NOT reference `personal-stack` anywhere in build/CI. Shared code comes from
  published versions only.
- Match existing style; detekt/ktlint + eslint/prettier must pass. No attribution;
  never write the word "Claude".
- You CANNOT run gradle (sandbox blocks the network for dep-fetch) or push/gh —
  the orchestrator builds via CI and commits/pushes. Run UI `npm`/`pnpm` checks
  only if deps are available; otherwise leave verification to CI.
- Keep changes coherent per component so they integrate cleanly.

## Out of scope (other specs / follow-ups)
- Session persistence / restart-with-history (spec 002).
- The agents-view UI redesign (spec 003).
- Re-namespacing `com.jorisjonkers.personalstack` → an ExtraToast namespace.
- The personal-stack-side removal + consume-the-released-images PR (orchestrator
  handles that separately).
