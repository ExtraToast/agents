# Feature Specification: Agents system-tests coverage

**Feature Branch**: `007-agents-system-tests`
**Created**: 2026-06-12
**Status**: Draft
**Input**: Re-home the end-to-end coverage removed from `personal-stack` during
the cut-over into the `agents` repo. The coverage must exercise agents UI, API,
auth/routing, chat/session flows, and the restart-with-history behavior, and it
must gate CI under `Pipeline Complete`.

## Overview

The extracted `agents` repo owns `agents-api`, `agents-ui`, `agent-gateway`, and
`agent-runner`, but the full system-test coverage that previously exercised the
agents UI/API flows was removed from `personal-stack` during the cut-over. The
current `personal-stack` system-tests README explicitly treats agents e2e
coverage as out of scope, while this repo currently has unit/integration tests
and a small UI Playwright smoke, not a production-shaped full-stack harness.

This feature restores that missing safety net in the `agents` repo. The harness
brings up the agents stack with production-equivalent routing/auth semantics,
runs the deleted chat/session journeys as agents-facing coverage, verifies
health and auth boundaries, and adds a restart-with-history end-to-end scenario
that depends on the durable-session capability from spec 002. It builds on spec
001 because the stack must already live in this repo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full-stack agents smoke catches broken deploys (Priority: P1)

A maintainer changes the agents API, UI, gateway, runner image, or routing/auth
configuration and gets a deterministic full-stack test result before merge. The
test harness starts the services together and verifies that health, liveness,
routing, and API/UI reachability work through the same external boundary users
exercise.

**Why this priority**: A green unit/integration suite is not enough for the
cut-over; the lost coverage specifically protected the assembled stack.

**Independent Test**: Start the system-test harness locally or in CI and run the
non-UI smoke suite. The suite must prove that `agents-api` health/liveness,
`agents-ui` serving, `agent-gateway`, runner availability, and auth/routing
boundaries all respond as expected.

**Acceptance Scenarios**:

1. **Given** the system-test harness, **When** it starts, **Then** `agents-api`,
   `agents-ui`, `agent-gateway`, and a runner environment are reachable by the
   tests with their required backing dependencies.
2. **Given** the public route to the agents UI/API, **When** an unauthenticated
   request reaches a protected path, **Then** the request is denied or redirected
   by Traefik forward-auth or the repo-owned auth shim.
3. **Given** an authenticated system-test user, **When** a protected agents API
   request reaches `agents-api`, **Then** the user identity is present through
   the `X-User-Id` contract and protected resources are available.
4. **Given** a running `agent-gateway` and runner environment, **When** the
   harness performs a basic gateway/runner readiness check, **Then** the gateway
   and runner path are proven usable before UI flows run.

---

### User Story 2 - Restored chat and session UI journeys (Priority: P1)

A maintainer can rely on agents UI e2e tests for the session and chat flows that
were previously covered in `personal-stack`. The restored journeys cover the
deleted `AssistantChatFlowTest`, `SessionsChatFlowTest`, cross-app session, and
logout/redirect behavior, translated to current agents naming and routes.

**Why this priority**: These are the specific flows lost in the cut-over. They
cover the highest-risk UI/API contract for daily agents use.

**Independent Test**: Run the Playwright-backed system-test suite against the
system-test stack. The suite creates or authenticates a test user, opens the
agents sessions surface, creates chat sessions, sends messages, switches
sessions, reloads history, and verifies auth session behavior.

**Acceptance Scenarios**:

1. **Given** an authenticated user with agents access, **When** the sessions
   view opens, **Then** the chat/session entry surface renders and exposes the
   expected chat/session controls.
2. **Given** the chat/session view, **When** a new chat session is created with a
   unique title, **Then** the session appears in the session list and becomes
   active.
3. **Given** an active chat session, **When** the user sends a message, **Then**
   the message appears in the transcript and survives a page reload.
4. **Given** multiple chat sessions, **When** the user switches between them,
   **Then** each session shows its own prior messages with no cross-session
   bleed.
5. **Given** an authenticated browser session, **When** the user navigates
   across the auth and agents surfaces, **Then** the session is honored where it
   should be and protected pages redirect when authentication is absent.
6. **Given** a logged-in user, **When** logout completes, **Then** protected
   agents routes require login again and redirect to the expected auth entry.

---

### User Story 3 - Restart-with-history is tested end to end (Priority: P1)

An operator can restart an agent runner after producing scrollback and continue
the same logical session. The system test proves the spec 002 behavior by
driving the real UI/API/gateway/runner path: produce output, restart the runner,
reattach, replay the full prior history, and continue with new input.

**Why this priority**: Spec 002 is valuable only if the assembled stack preserves
history across the same restart path used in production.

**Independent Test**: Run the restart-with-history system test against a harness
that includes the durable-session implementation. The test creates scrollback,
forces a runner restart through the supported control/path, reopens the session,
and asserts replay plus continuation.

**Acceptance Scenarios**:

1. **Given** a live agent session with several distinguishable output lines,
   **When** the runner is restarted, **Then** the session becomes available again
   under the same logical session identity.
2. **Given** the restarted session, **When** the UI or API reattaches, **Then**
   the complete supported scrollback is replayed in order with no duplicated or
   missing lines.
3. **Given** replay has completed, **When** new input is sent, **Then** the
   restarted runner accepts it and emits new output after the restored history.
4. **Given** the restart advanced the session epoch, **When** the client
   reconnects with an old offset, **Then** the client receives the correct
   full-snapshot behavior defined by spec 002.

---

### User Story 4 - System tests gate merges (Priority: P1)

The CI pipeline treats system tests as required release confidence, not an
optional follow-up. The agents `Pipeline Complete` job depends on the system-test
job so a broken UI/API/auth/session flow blocks merge the same way unit,
contract, and image-build failures do.

**Why this priority**: Restored coverage is only useful if it runs in the
required pipeline.

**Independent Test**: Open a PR that triggers the agents CI workflow. The
system-test job runs, reports artifacts/diagnostics on failure, and the
`Pipeline Complete` aggregator fails when the job fails.

**Acceptance Scenarios**:

1. **Given** a normal PR, **When** agents CI runs, **Then** the system-test job
   starts the harness, runs the smoke and Playwright-backed flows, and publishes
   diagnostics sufficient to debug failures.
2. **Given** any system-test failure, **When** CI reaches `Pipeline Complete`,
   **Then** `Pipeline Complete` fails.
3. **Given** all other jobs pass but system tests are skipped unexpectedly,
   **When** `Pipeline Complete` evaluates, **Then** the pipeline is not green.

### Edge Cases

- Auth mode differs between local and CI runs: both must preserve the same
  protected-route contract and `X-User-Id` propagation.
- The gateway is healthy but the runner path is not usable: the harness must
  fail before chat/terminal scenarios give misleading UI failures.
- The UI route is reachable directly but fails through the public gateway/auth
  boundary: system tests must cover the boundary, not only internal service
  ports.
- Browser tests leave persisted chat/session data behind: test data must be
  unique and isolated enough for reruns and shards.
- Restart happens while output is still streaming: the restart-with-history test
  must wait on observable replay/continuation conditions, not fixed sleeps.
- Spec 002 is not implemented yet: restart-with-history coverage may be added as
  a pending or excluded scenario only until the dependent capability lands, then
  it must become gating.
- The old personal-stack test source is no longer present in the current
  `personal-stack` tree: implementation must recover the deleted test inventory
  from PR #657 or git history before declaring parity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `agents` repo MUST include a system-test harness that can run
  locally and in CI, using either Docker Compose or Testcontainers, without
  relying on the current `personal-stack` source tree.
- **FR-002**: The harness MUST bring up `agents-api`, `agents-ui`,
  `agent-gateway`, and a runner environment, plus the required backing services
  for API persistence/messaging/cache and any auth/routing fixture.
- **FR-003**: The harness MUST exercise the public agents UI/API boundary
  through Traefik forward-auth or a repo-owned auth shim that preserves the
  protected-route and `X-User-Id` semantics used by `agents-api`.
- **FR-004**: The non-UI smoke suite MUST verify health/liveness for
  `agents-api` and the gateway/runner path before browser flows run.
- **FR-005**: The restored browser suite MUST cover the behavior of the deleted
  `AssistantChatFlowTest`: chat empty state, creating a chat session, sending a
  message, switching sessions, and message persistence after reload, translated
  to current agents naming/routes.
- **FR-006**: The restored browser suite MUST cover the behavior of the deleted
  `SessionsChatFlowTest`: the sessions entry surface renders, a user can start a
  chat session and send a message, and navigation reaches the sessions entry.
- **FR-007**: The restored browser suite MUST cover cross-surface auth/session
  behavior from the old personal-stack system tests: cross-app session reuse,
  protected-page redirect, and logout clearing access to protected agents pages.
- **FR-008**: The suite MUST include a restart-with-history end-to-end test for
  spec 002 that produces scrollback, restarts the runner, asserts full supported
  replay, and proves new input/output continues in the same logical session.
- **FR-009**: The restart-with-history test MUST use the same session identity,
  epoch/offset, replay, and continuation semantics defined by spec 002.
- **FR-010**: The implementation MUST recover and document the removed
  personal-stack agents coverage from PR #657 or git history as the starting
  point, including any test cases not visible in the current `personal-stack`
  checkout.
- **FR-011**: CI MUST run the system-test suite as a gating job in the agents
  workflow and include that job in the `Pipeline Complete` dependency set.
- **FR-012**: CI diagnostics MUST capture enough service logs, browser traces or
  screenshots, and harness state to debug failed system-test runs without
  rerunning locally first.
- **FR-013**: System tests MUST be shardable or otherwise bounded so the required
  CI job remains practical for normal PRs.
- **FR-014**: The harness MUST support a deterministic local command for running
  the same suite or documented subsets used in CI.
- **FR-015**: The system-test stack MUST avoid committing secrets and must use
  local/CI-only credentials, test users, or auth fixtures.

### Key Entities *(include if feature involves data)*

- **System-test harness**: The local and CI entry point that starts the agents
  stack, waits for readiness, runs smoke/browser tests, and collects diagnostics.
- **Agents stack under test**: `agents-api`, `agents-ui`, `agent-gateway`, and
  the runner environment exercised together.
- **Auth boundary**: Traefik forward-auth or an equivalent repo-owned shim that
  denies unauthenticated requests and injects the user identity expected by the
  API.
- **Chat/session journey**: The restored end-to-end user path for opening
  sessions, creating chat sessions, sending messages, switching sessions, and
  reloading persisted chat state.
- **Restart-with-history journey**: The spec 002 validation path that verifies
  scrollback replay and continuation across runner restart.
- **Pipeline gate**: The agents CI job that runs the system tests and feeds the
  required `Pipeline Complete` check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh local system-test run starts the harness and passes the
  health/liveness/auth smoke suite without requiring `personal-stack`.
- **SC-002**: The restored chat/session browser suite passes against the harness
  and covers create, send, switch, reload persistence, cross-session isolation,
  cross-surface session, logout, and protected redirect behavior.
- **SC-003**: Once spec 002 is available, the restart-with-history e2e passes in
  CI by proving ordered replay of all supported scrollback and successful
  continuation after runner restart.
- **SC-004**: The agents CI workflow includes the system-test job in
  `Pipeline Complete`; forcing a system-test failure makes `Pipeline Complete`
  fail.
- **SC-005**: A failed CI system-test run publishes actionable diagnostics
  (service logs plus browser trace/screenshot artifacts for browser failures).
- **SC-006**: The system-test suite completes within the agreed PR budget after
  sharding or suite splitting is applied.

## Assumptions

- Spec 001 has already moved the stack into this repo and established the agents
  CI shape with a `Pipeline Complete` aggregator.
- Spec 002 supplies the durable-session behavior required by the
  restart-with-history e2e; the test can be introduced before spec 002 only as
  non-gating/pending coverage.
- The current `agents-api` `system-test` profile and stub runner orchestrator
  are valid source context for tests that do not need a real Kubernetes runner,
  but the restart-with-history scenario still needs a runner path that exercises
  durable scrollback behavior.
- The current `personal-stack` system-tests module is useful as harness
  reference material, but agents-specific parity must be recovered from the
  deleted test history and PR #657.

## Non-Goals

- Implementing durable session persistence itself; that belongs to spec 002.
- Redesigning the agents UI; this suite should follow the UI produced by spec
  003 rather than prescribe its layout.
- Reintroducing agents e2e coverage into `personal-stack`.
- Testing unrelated `personal-stack` auth, app, mail, or downstream OIDC flows
  except where needed to prove the agents auth/session boundary.
- Publishing production deployment manifests or changing public routing outside
  what the test harness requires.

## Open Questions

- **OQ-001**: [NEEDS CLARIFICATION: the exact PR #657 removed-test inventory is
  not present in this worktree; implementation must recover it from git history
  or PR metadata before final parity can be claimed.]
- **OQ-002**: The harness backend is intentionally open between Docker Compose
  and Testcontainers; planning should choose the option that best matches repo
  CI runtime and diagnostics.
- **OQ-003**: The final CI time budget and shard count should be set during
  planning after the restored browser and restart-with-history flows are
  measured.
