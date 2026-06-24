# Contract: upgrade the workspace runner

## POST /api/v1/workspaces/{id}/runner/upgrade

Force-recreate the workspace's runner Pod onto the current target agent-runner image and continue every bound session (conversation preserved). Serialized via the boot lease; no-op when already current.

**Request**: no body (the target is the current `:latest`). Header `X-User-Id` (edge-injected identity), as on the other workspace routes.

**Response** (200): JSON
```json
{
  "state": "upgrading" | "already-current" | "unavailable",
  "runnerImage": { "digest": "5ef25c126d10", "upgradeAvailable": false }
}
```
- `upgrading` — recycle started; the client then drives the existing reattach/replay flow (poll the workspace / restart-and-continue states) as it does for a session restart.
- `already-current` — runner digest already equals the freshest observed; no recycle performed.
- `unavailable` — no runner to upgrade / provisioning could not start; recoverable, retryable.

**Errors**: 404 unknown workspace; 409 when another connect/restart/upgrade holds the boot lease (client retries); 503 when the runner cannot be provisioned (mirrors `/connect`).

## Workspace response addition

The existing workspace detail / connect response gains:
```json
"runnerImage": { "digest": "5ef25c126d10" | null, "upgradeAvailable": true }
```
`digest` is null when no runner is provisioned. `upgradeAvailable` drives the UI "Update runner" control.

## Notes

- Reuses `RunnerSessionBinder.restart()` semantics for continuation (epoch++, resumeCliSessionId, ContinuationMetadata reason = "runner-image-upgrade").
- The `/workspace` PVC is preserved (scaleDown keeps the PVC; only the Pod + Service are recreated).
- If WorkspaceController responses are untyped `ResponseEntity<*>` like the credential endpoints, no openapi/generated.ts change is required; if they are typed DTOs, regenerate `openapi.json` + agents-ui `generated.ts`.
