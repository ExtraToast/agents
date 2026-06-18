# Feature Spec: Fix new-session creation 409 "session generation conflict"

## Outcomes
- `POST /api/v1/workspaces/{id}/sessions` never surfaces HTTP 409 "session generation conflict" to the user. A transient bind race on a freshly created session is eliminated at the source, not remapped.
- New sessions are persisted already `RUNNING` and bound in a single write after a successful gateway spawn; there is no post-insert generation CAS for new rows.
- Genuine runner cold-start still returns a retryable 503 before any row is created.
- Restart retains `Conflict` -> 409 for a stale `expectedGeneration` (shared paths untouched).
- Frontend handles create-session failures gracefully: no raw `ApiError` to console, explicit user-facing state, retry vocabulary matching backend labels.
- Regression test fails on `origin/main@02110db` and passes after the fix.

## Non-Goals
- Changing `SendUserInputCommandHandler`'s 409 (real stale/missing/restart conflicts) unless reproduction implicates the input path.
- Touching `spawnAndBind`, `ensureBoundInternal`, or `restartInternal`.
- Adding a new repository method (existing UPSERT `save` writes RUNNING+bound in one call).
- Async 202 start flow.

## Conflict-source taxonomy

Every site that returns `RunnerSessionBindingResult.Conflict` is listed below, together with its CAS guard and an assessment of whether it can affect a brand-new `STARTING` row during the **spawn window** — the interval between `sessions.save(STARTING, generation=1)` at `RunnerSessionBinder.kt:87` and the `sessions.bindIfGeneration(id, generation=1, ...)` call inside `spawnAndBind`.

### Conflict return sites

| Site | Operation | CAS guard | Can touch brand-new STARTING row? | Notes |
|---|---|---|---|---|
| `spawnAndBind` — `tx.bind()` returns false | Start / EnsureBound / Restart | `bindIfGeneration(id, expectedGeneration=N)` | **Yes — root bug path** | If a concurrent writer bumps generation from 1 to 2, `bindIfGeneration(gen=1)` returns 0 rows and Conflict is returned |
| `spawnAndBind` — `tx.bind()` throws | Start / EnsureBound / Restart | — | Yes | DB/runtime exception during bind causes `stopAgent` + Conflict return |
| `restartInternal` — session not found | Restart | — | No | Returns `Conflict(current = null)`; a freshly saved row exists |
| `restartInternal` — stale `expectedGeneration` | Restart | Caller-supplied value vs `session.generation` | No | Client must supply a known generation; brand-new sessions are not yet presented in the UI |
| `restartInternal` — pending setup or workspace setup in progress | Restart | Workspace CAS fields (`runnerSetupOperation`, `pendingRunnerSetupId/Version`) | No | `checkBindingReadiness` in `startInternal` blocks start when setup is non-IDLE; a concurrent restart cannot be in flight for a just-created session |
| `restartInternal` — `tx.beginWorkspaceSetupOperation` CAS miss | Restart | `(workspace.id, runnerSetupGeneration)` | No | Workspace-level CAS only; no session row is written |
| `restartInternal` — `tx.beginSetupGeneration` CAS miss → `BindingRaceException` | Restart | `(id, currentSetupId/Version)` + `(id, generation)` | No | Only reachable via `promotePendingSetup=true` (restart path); brand-new session has no pending setup |
| `restartInternal` — `tx.completeWorkspaceSetupOperation` CAS miss | Restart | `(workspace.id, runnerSetupGeneration)` | No | Workspace-level CAS; session row has already advanced past STARTING |
| `ensureBoundInternal` — session not found | EnsureBound | — | No | Requires the row to be deleted concurrently; new row was just saved |
| `ensureBoundInternal` — pending setup | EnsureBound | `session.pendingSetupId != null` | No | Pending setup is set only by `restartInternal`; `startInternal` never sets it |
| `ensureBoundInternal` → `tx.beginGeneration` CAS miss | EnsureBound | `beginGeneration(id, expectedGeneration=N)` | **Yes — plausible concurrent mutator** | `ensureBoundInternal` accepts STARTING status (line 231–236 guards `RUNNING \|\| STARTING` only); if it wins `beginGeneration(gen=1→2)`, `startInternal`'s subsequent `bindIfGeneration(gen=1)` misses |

### Session-row mutators: reach analysis for the spawn window

| Mutator | Callers | Guard against new STARTING row | Verdict |
|---|---|---|---|
| `sessions.save(session)` | `startInternal` (initial UPSERT) | None | Creates the row — no conflict |
| `sessions.beginGeneration(id, expectedGen, nextEpoch)` | `tx.beginGeneration` (ensureBoundInternal), `tx.beginSetupGeneration` (restartInternal) | CAS on `expectedGeneration` only | **Reachable** — `ensureBoundInternal` with a concurrent `SendUserInput` for a STARTING session bumps gen 1→2 |
| `sessions.bindIfGeneration(id, expectedGen, gatewayAgentId, cliSessionId)` | `tx.bind` (all three binding paths) | CAS on `expectedGeneration` | Intended final write; loses the race if `beginGeneration` wins first |
| `sessions.clearGatewayBindingIfGeneration(id, expectedGen, now)` | `IdleScaleDownScheduler.clearGatewayBindings`, `RunnerMaintenanceService.clearGatewayBindings`, `UpstreamHandler.afterConnectionClosed` | Callers pre-filter `.filter { it.gatewayAgentId != null \|\| it.gatewayBoundAt != null }` | Not reachable — new STARTING row has both null |
| `sessions.markLifecycleIfGeneration(id, expectedGen, status, ...)` | `StopAgentSessionCommandHandler`, `tx.markFailed` (spawn exception path) | STOP skips rows already in STOPPED/FAILED; markFailed only on explicit spawn failure | Theoretically reachable if a user stops a just-created session, but not a recurring production pattern |
| `sessions.markCleanupRequested(id, now)` | `DurableSessionCleanupService.markExpiredSessionsPending` | `findReadyForCleanup(now, …)` only returns sessions past `retainedUntil` | Not reachable — new session has no `retainedUntil` |
| `sessions.delete(id)` | `StopAgentSessionCommandHandler` (second stop on terminal row), `DurableSessionCleanupService.cleanupPendingSession` | Session must be STOPPED/FAILED (stop) or have `cleanupRequestedAt` set (cleanup) | Not reachable |
| `sessions.setPendingSetupIfCurrent(...)` | `tx.beginSetupGeneration` (restartInternal) | CAS on `(currentSetupId, currentSetupVersion)` | Not reachable in practice — restart is not issued against a session created milliseconds ago |
| `sessions.promotePendingSetupIfCurrent(...)` | `tx.bind` with `promotePendingSetup=true` | Only the restart path sets that flag | Not reachable — `startInternal` passes `promotePendingSetup=false` |
| `sessions.clearPendingSetupIfCurrent(...)` | `tx.markFailed` | Only called when `pendingSetupId != null` | Not reachable — new session has no pending setup |

### ensureBound callers

| Caller | Location | Guard on session status | Can be dispatched for a STARTING row? |
|---|---|---|---|
| `SessionAttachHandler.resolveAttach()` | `SessionAttachHandler.kt:142` | `status == RUNNING && gatewayAgentId == null` | No — explicit RUNNING guard |
| `SessionAttachHandler.UpstreamHandler.afterConnectionClosed` | `SessionAttachHandler.kt:506–516` | Gateway BAD_DATA "unknown agent" close | No — the upstream WS is never opened for a STARTING session; `resolveAttach` closes the client at line 166–174 before the upstream connect |
| `SendUserInputCommandHandler.resolveBinding()` | `SendUserInputCommandHandler.kt:47` | No session-status guard | **Yes** — if a concurrent sendInput arrives for a session that was just created and has not yet been bound, `ensureBoundInternal` runs against a STARTING row |
| `StageAgentInputCommandHandler.handle()` | `StageAgentInputCommandHandler.kt:19` | No session-status guard | Dead code — never dispatched; `AgentSessionController.stageInput` calls the gateway directly; this handler will be removed |

### StaleRunnerSetupLeaseReaper

`StaleRunnerSetupLeaseReaper` writes only workspace rows (`workspaces.releaseStaleRunnerSetupOperation`) and never touches session rows. It cannot cause a generation CAS miss.

## Decisions

- **Structural fix scope**: change `startInternal` only. Spawn the gateway agent first using the stable session ID, then persist the session already `RUNNING` and bound (`gatewayAgentId` set) in a single `sessions.save()` write. On persistence failure, stop the spawned gateway agent and return `Unavailable` (no `STARTING` row left behind). The shared `ensureBound`/`restart` paths and `spawnAndBind` are untouched.
- **Error representation**: `StartAgentSessionCommandHandler` maps `Conflict` → `AgentRunnerUnavailableException` (503) as a defensive fallback — now unreachable on the happy path. Do not invent a 422, do not add a 202 async flow, do not fabricate a `runnerStatus` value beyond existing retry semantics.
- **SendUserInput 409 left intact**: `SendUserInputCommandHandler` maps `Conflict` → `error("session generation conflict")` which produces 409. This is left unchanged (out-of-scope) unless production incidents directly implicate the input path.
- **Dead code removal**: `StageAgentInputCommand`, `StageAgentInputCommandHandler`, and `StageAgentInputCommandHandlerTest` are never dispatched. `AgentSessionController.stageInput` calls the gateway directly. All three files are deleted.
- **UUID collision on upsert**: the fix retains UPSERT `save()` semantics. A UUID4 collision with an existing session ID is accepted as negligible risk (~1 in 2^122 per session); no deduplication guard is added.
- **Deployment**: CI builds are push:false (`ci.yml:214`); only `release.yml:92` publishes a tagged image. Rolling this fix to `agents.jorisjonkers.dev` requires: (1) merge the PR, (2) cut a release tag on the merged commit, (3) bump the image tag in the personal-stack manifest, (4) GitOps picks it up. See `specs/004` for personal-stack GitOps ownership details.

## Open questions

- **Production root-cause**: which specific concurrent caller bumped the generation on the brand-new STARTING row in recurring production incidents? `SendUserInputCommandHandler` calling `ensureBoundInternal` (no session-status guard) is the most structurally plausible concurrent mutator, but CAS-miss instrumentation — logging `current row generation/status/gatewayAgentId` when `bindIfGeneration` returns 0 rows — must confirm the actual winner before the fix ships. The structural fix eliminates the window regardless of which caller wins the race.
- **Whether any enumerated mutator can bump generation on a brand-new STARTING row during the spawn window**: the analysis above identifies `ensureBoundInternal` (via `SendUserInputCommandHandler`) as the only reachable concurrent path. Whether this actually occurs in production at a frequency that explains the recurring 409s depends on the dispatch timing; the instrumentation log will confirm or rule it out.
