# Brief: Finally fix new-session creation (recurring 409 "session generation conflict")

## Goal
Creating a workspace and then creating a session in ExtraToast/agents must reliably
succeed. Today (2026-06-18) `POST /api/v1/workspaces/{id}/sessions` still returns
HTTP **409 "session generation conflict: <uuid>"** against agents.jorisjonkers.dev
(observed on workspace `6d324570-b28e-4cce-83cf-5c35fa0bcda4`). PR #51 (merged
2026-06-17, commit `02110db`, spec `specs/013-repair-session-runner-boot`) was
supposed to fix exactly this and did **not** — `origin/main` is at `02110db` and the
defect below is still present in that code, so this is a real code defect, not only
a stale deployment.

## Grounded root-cause findings (verified in code; validate + reproduce, do not blindly trust)
1. `services/agents-api/.../application/command/StartAgentSessionCommandHandler.kt:35`
   maps `RunnerSessionBindingResult.Conflict -> error("session generation conflict: …")`
   -> `IllegalStateException` -> HTTP **409** (via kotlin-spring-commons
   `GlobalExceptionHandler` — confirm the exact mapping in commons). The identical
   `Conflict -> 409` mapping exists in `SendUserInputCommandHandler.kt:54` and
   `StageAgentInputCommandHandler.kt:28`, so user retries also 409.
2. `RunnerSessionBinder.spawnAndBind` (`RunnerSessionBinder.kt:268-312`) is **shared**
   by `start`/`restart`/`ensureBound` and returns `Conflict` whenever
   `RunnerSessionBindingTransactions.bind -> JooqWorkspaceAgentSessionRepository.bindIfGeneration`
   CAS (`WHERE id=? AND generation=?`) matches 0 rows, or when `promotePendingSetup`
   throws `BindingRaceException`. PR #51's claim that the CAS-conflict path is
   "confined to restartInternal" is therefore **false** for new-session creation.
3. A new session is created at epoch=1, generation=1 and saved at
   `RunnerSessionBinder.kt:87`, then `spawnAndBind` binds with `expectedGeneration=1`
   in a **separate** `@Transactional RunnerSessionBindingTransactions.bind`.
   `SpringCommandBus.dispatch` (`config/CommandBusConfig.kt`) is **not** `@Transactional`
   and `StartAgentSessionCommandHandler` is **not** `@Transactional`, so the INSERT and
   the bind CAS are not in one transaction. A CAS miss on a brand-new random-UUID row
   means one of:
   - (a) transaction-visibility / commit ordering between `sessions.save` and the
     `@Transactional` bind;
   - (b) frontend double-submit / EventSource auto-reconnect causing a concurrent
     generation bump (PR #51 added a FE "start de-dup" — verify it actually prevents this);
   - (c) a background reconciler / `ensureBound` bumping generation between save and bind;
   - (d) deployed image older than `02110db` (less likely, since the defect is in main).

   **Planners MUST determine which is actually happening — reproduce it in a test or
   locally — not just theorize.**

## Required outcomes
- New-session creation **never** surfaces a 409 "session generation conflict" to the
  user. A transient bind race on a freshly-created session must be retried server-side
  or returned as a retryable 503/202 — never a hard 409.
- Root-cause the actual production CAS miss (reproduce it) and fix it at the source,
  not merely remap the status code.
- Frontend `WorkspaceView` handles the create-session response gracefully — no raw
  `ApiError: session generation conflict` thrown to console; sensible retry/backoff or
  clear user-facing state.
- Verify end-to-end: create workspace -> create session succeeds. Add a regression test
  that **fails on today's code and passes after** the fix.
- Confirm the deployment path: verify the merged fix is actually rolled out (deployed
  image/tag vs main). A fix that isn't deployed is part of why this keeps "not working."

## Process / constraints
- Branch off `origin/main` (`02110db`), NOT the current `feat/capacitor-scaffold`.
- Land as a spec + PR; org **"Pipeline Complete"** must be the green required check.
- Codex workers cannot run gradle (sandbox blocks sockets) — CI is the real gate;
  verify `files_changed`, not verdict prose.
- Isolated work in git worktrees; push via
  `https://x-access-token:$(gh auth token)@github.com/ExtraToast/agents` (remote is SSH-only).
- No Claude/AI co-author trailers, no "Generated with Claude Code".
- Follow the agents spec CI repair playbook: detekt/ktlint, compileTestKotlin,
  openapi-contract, banner, local-UI-verify.
