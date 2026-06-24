# Research: continue a workspace onto an updated agent-runner image

## Verified facts (live cluster, 2026-06-23)

- Runner Pods run `ghcr.io/extratoast/agents/agent-runner:latest` with `imagePullPolicy: Always`. Recreating the Pod re-pulls the current `:latest` digest — no digest-pin needed to force a fresh image.
- The three live runner Pods each resolved a *different* agent-runner digest (`status.containerStatuses[0].imageID`), and none was flagged stale.
- `Fabric8AgentRunnerOrchestrator.computeReleaseMarker()` reads the **agents-api** Pod's own `imageID` and stamps it as `ANNOTATION_IMAGE_MARKER`; `isRunnerImageStale()` compares that — so staleness tracks agents-api releases, not the agent-runner image. A runner-image bump is invisible to it.
- `RunnerSessionBinder.restart()` already force-provisions + `spawnAgentWithRetry` with `stableSessionId`, `epoch++`, `resumeCliSessionId`, and `ContinuationMetadata` — the conversation-preserving recycle. The upgrade reuses this rather than inventing a new revival path.

## Decisions

1. Identify the runner image by its resolved digest (`status.containerStatuses[0].imageID`), surfaced on `RunnerState`; authoritative value read from Pod status at request time.
2. Detect "behind" without registry credentials via the freshest agent-runner digest observed among running runner Pods in the namespace: `upgradeAvailable = runnerDigest != freshestObserved`. Relative-staleness; the explicit action never depends on it.
3. Force-recreate the Pod for the upgrade (scaleDown + provision); Always-pull resolves the current `:latest`. A `force` flag bypasses the "already ready" short-circuit so a ready-but-behind runner is still recreated.
4. Idempotent/serialized via the existing boot lease; no-op + "already up to date" when `runnerDigest == freshestObserved`.
5. Idle auto-upgrade: extend `IdleScaleDownScheduler` to also recycle idle (no clients, agents idle past grace) runners whose digest != freshest; next connect reprovisions onto latest.

## Rejected alternatives

- Registry query for the `:latest` digest — agents-api has no ghcr credentials; not needed (action/sweep-driven; detection only needs a relative signal).
- Digest-pin `AGENT_RUNTIME_IMAGE` in personal-stack Flux + agents-api redeploy — most deterministic but couples the runner release to a cross-repo manifest bump. Out of scope; revisit if relative-staleness proves insufficient.
