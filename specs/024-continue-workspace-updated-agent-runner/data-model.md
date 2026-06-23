# Data Model: continue a workspace onto an updated agent-runner image

No new persisted columns. Runner image identity is read from the Kubernetes API at request time; `upgradeAvailable` is derived.

## RunnerState (runtime projection, read from the Pod)

| Field | Source | Notes |
| --- | --- | --- |
| `runnerImageDigest` (new) | `pod.status.containerStatuses[0].imageID` | The agent-runner digest the Pod resolved at pull time. Null when not yet pulled/ready. |
| existing fields | unchanged | podName, phase, containerReady, setupId/version, runnerGeneration, imageMarker (agents-api digest — kept) |

## Derived per workspace (in the workspace/connect response DTO)

| Field | Derivation |
| --- | --- |
| `runnerImage.digest` | short form of the workspace runner's `runnerImageDigest` (e.g. last 12 hex chars), or null when no runner |
| `runnerImage.upgradeAvailable` | `runnerImageDigest != freshestObservedDigest` where freshestObservedDigest = the most-recently-provisioned running runner's digest in the namespace; false when unknown or equal |

## Orchestrator port additions

- `runnerImageDigest(workspace): String?` — the workspace runner's resolved digest.
- `freshestRunnerImageDigest(): String?` — newest agent-runner digest observed across running runner Pods.
- `provision(..., force=true)` semantics / a `recreate(workspace)` that scales down then provisions regardless of current readiness.

## Session continuity (unchanged, reused)

`WorkspaceAgentSession.epoch` / `generation` increment via the existing `RunnerSessionBinder.restart()`; `stableSessionId` + `resumeCliSessionId` carry conversation continuity across the recycle.
