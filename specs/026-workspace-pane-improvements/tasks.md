# Tasks: Workspace right-pane improvements

agents-ui only. Single stacked PR (after or alongside 025's UI contract regen).

- [ ] T001 Booting state: `workspaces` store `restartSession` maps 503 `not_ready_after_provision` → transient `reconnecting` (not `failed`); add label/copy; clear on rebind. Tests.
- [ ] T002 Version refresh: re-fetch workspace on connection-settle / restart `live` so the rail's `runnerImage` updates without reload. Test with a simulated rebind.
- [ ] T003 Remove setup clutter: delete `SessionSetupPicker` / `SessionSetupDiff` / setup-options / setup-preview from `WorkspaceView`; simplify the restart confirmation; drop dead store usage. Update WorkspaceView/rail tests.
- [ ] T004 Agent icons: local Claude Code + Codex SVGs; render in `AgentKindPicker` + `SessionStatusChip`/session tabs with aria-labels; neutral fallback. Tests.
- [ ] T005 typecheck + lint + contract:check + full vitest; PR.
