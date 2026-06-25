# Implementation Plan: Workspace right-pane improvements

agents-ui only. Builds on the shipped async-restart backend (restart returns 503 `not_ready_after_provision` and the session self-heals on attach).

## Changes

1. **Version refresh (FR-001)** — `WorkspaceView` already re-fetches workspace state on restart transitions; ensure the rail's `runnerImage` is re-read when the session connection settles / rebinds (watch the status-rail connection → `open` and on restart `live`, call the existing workspace re-fetch). The rail binds `store.activeWorkspace.runnerImage`, so a workspace re-fetch updates it.

2. **Remove setup clutter (FR-002)** — delete from `WorkspaceView` lifecycle section: `SessionSetupPicker`, `SessionSetupDiff`, `restartSetupControlsVisible`, the setup-options loading + setup-preview wiring, and the setup-targeted bits of the restart confirmation (reduce it to "Restart and reattach?"). Drop now-dead store calls (`loadSetupOptions`, `loadSetupPreview`, `selectRestartTarget`, setup preview/validation state) from the view's usage. Keep the components/store actions themselves if still referenced elsewhere; otherwise remove. Update WorkspaceView tests.

3. **Booting vs failed (FR-003)** — `workspaces` store `restartSession`: on an `ApiError` with status 503 and `runnerStatus === 'not_ready_after_provision'`, set a transient `reconnecting` restart state (not `failed`) and drive the existing reattach/poll loop; clear it when the session rebinds (status RUNNING + bound) via the connection-settle watch. Add a `reconnecting` label/copy. 409 already reattaches; only true errors become `failed`.

4. **Agent icons (FR-004/005)** — add local SVG product icons for Claude Code and Codex under `agents-ui` public assets; render them in `AgentKindPicker` and `SessionStatusChip`/`session-tab` with `aria-label`/`alt`. Neutral fallback for unknown kind. Hand-crafted placeholders are acceptable per repo policy (no external fetch).

## Testing
- `SessionStatusRail` / `WorkspaceView` tests: no setup controls present; version updates on a simulated rebind; booting 503 shows reconnecting not failed and clears on rebind; icon renders with aria-label.
- typecheck + lint + `contract:check` + full vitest green.

## Constitution compliance
agents-ui only; small PR; no external asset fetch (placeholders unless the operator provides icons); match existing rail/chip styling.
