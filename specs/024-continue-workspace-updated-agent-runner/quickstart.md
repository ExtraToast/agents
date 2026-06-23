# Quickstart / Validation: continue a workspace onto an updated agent-runner image

## Automated

- agents-api: `./gradlew :services:agents-api:test :services:agents-api:ktlintCheck`
  - orchestrator: runner-image digest read from Pod status; `freshestRunnerImageDigest`; `upgradeAvailable` derivation; force-recreate path.
  - lifecycle: `upgradeRunner` recreates + continues; no-op when current; serialized by the boot lease.
  - idle sweep: recycles idle behind-image runners; never with connected clients / non-idle agents.
  - controller: `POST /workspaces/{id}/runner/upgrade` states; `runnerImage` on the workspace response.
- agents-ui: `pnpm typecheck && pnpm lint && pnpm test`
  - workspaces store `upgradeRunner()` posts the endpoint and drives reattach/replay states.
  - `SessionStatusRail` renders up-to-date vs upgrade-available and gates the "Update runner" button.

## Manual (post-deploy)

1. Open a workspace whose runner is on an older agent-runner digest (`kubectl get pod agent-runner-<short> -o jsonpath='{.status.containerStatuses[0].imageID}'`).
2. Confirm the UI shows the runner image and, if behind, an "Update runner" / upgrade-available indicator (not the old "default@v1 / Gen 1" as the primary status).
3. Click "Update runner". Confirm:
   - The runner Pod is recreated and its new `imageID` digest equals the current `:latest` digest.
   - The agent session resumes the prior conversation (recent history present; agent answers with context) — not a blank session.
   - `/workspace` contents and attached repos survived (PVC preserved).
4. Confirm a workspace already on the freshest digest reports "already up to date" and does not recreate.
5. Leave a behind-image workspace idle (disconnect; agents idle past grace) and confirm the idle sweep recycles it onto the latest image, while an in-use behind-image workspace is left untouched.
6. With refreshed credentials present in the runner env (`agents-claude-oauth` Secret populated), confirm the upgraded runner reads the new credential. (If the Secret is absent — current state — the runner behaves exactly as before; no regression, no false "updated" claim.)
