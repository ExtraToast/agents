# Feature Specification: Workspace right-pane improvements

**Feature Branch**: `feat/user-credential-redesign`
**Created**: 2026-06-24
**Status**: Draft
**Input**: The workspace right pane carries clutter the operator can't act on and a stale runner-version readout, and "Update runner" surfaces a hard "restart failed" while the runner is merely booting. Clean it up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Runner version reflects reality after an update (Priority: P1)
After "Update runner", the displayed runner version updates to the new release once the runner is live, without a manual page reload.

**Acceptance**: Given a runner upgrade completes, when the new runner is bound, then the rail shows the new version and clears "update available" without a reload.

### User Story 2 - No unusable setup/options clutter (Priority: P1)
The right pane shows only what the operator can act on. The setup picker, setup-options, and setup-diff controls — which the operator cannot meaningfully change — are removed.

**Acceptance**: Given any workspace, when the operator views the right pane, then no setup-selection / setup-diff / setup-options controls are present; the runner-image tile + Update runner remain.

### User Story 3 - Updating reads as "in progress", not "failed" (Priority: P1)
While a reprovisioned runner is still booting, the UI shows an "updating / reconnecting" state that clears on its own once the session rebinds — not a stuck "restart failed".

**Acceptance**:
1. Given an update returns the booting (503 `not_ready_after_provision`) response, when the UI handles it, then it shows "Updating runner — reconnecting…", not "restart failed".
2. Given the runner becomes ready and the session rebinds, then the updating state clears automatically.
3. Given a genuine failure (not booting), then a clear failed state with a retry/dismiss is still shown.

### User Story 4 - Agent kind is recognizable by icon (Priority: P2)
Claude Code and Codex sessions are identified by their product icons in the agent-kind picker and session chips, not text alone.

**Acceptance**: Given a Claude Code or Codex session, when shown in the picker/chip, then its product icon renders (with an accessible label).

### Edge Cases
- Booting state must not hang forever if the runner never becomes ready → falls through to a failed state after a bounded period / on a non-booting error.
- Missing/unknown agent kind → neutral fallback icon, no broken image.
- Icons are local assets (no external fetch).

## Requirements *(mandatory)*
- **FR-001**: After an upgrade completes and the session rebinds, the runner-version readout MUST reflect the new version without a reload (re-fetch workspace state on rebind/connection settle).
- **FR-002**: The setup picker, setup-options loading, and setup-diff/preview controls MUST be removed from the workspace right pane.
- **FR-003**: A booting reprovision (503 `not_ready_after_provision`) MUST render as a transient "updating / reconnecting" state that auto-clears when the session rebinds, distinct from a hard failure.
- **FR-004**: Claude Code and Codex MUST be represented by product icons (local assets) with accessible labels in the agent-kind picker and session chips.
- **FR-005**: No external asset fetches; icons ship in the repo.

## Success Criteria *(mandatory)*
- **SC-001**: Post-upgrade, the version updates with no reload in 100% of successful upgrades.
- **SC-002**: No setup/options/diff control is reachable in the right pane.
- **SC-003**: A booting update never shows "restart failed"; it shows updating and clears on rebind.
- **SC-004**: Claude/Codex sessions render their product icon with an aria-label.
