# Feature Specification: Continue a workspace onto an updated agent-runner image

**Feature Branch**: `024-continue-workspace-updated-agent-runner`
**Created**: 2026-06-23
**Status**: Draft
**Input**: Operator cannot move a live workspace onto a newer agent-runner container image while continuing the session. Runner Pods keep their original image after the image is rebuilt/republished; "stale runner" detection compares the agents-api image, not the agent-runner image, so a runner-image bump is never noticed; and restarting the session does not pick up a new image (nor refreshed credentials projected into the runner environment).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continue a workspace onto the latest runner image (Priority: P1)

The operator is working in a workspace whose runner is on an older agent-runner image (e.g. an older Claude CLI, or before a credential refresh). A newer runner image has been published. From the workspace, the operator continues onto the latest runner image: the runner is recycled onto the newer image, the workspace's files and attached repositories are preserved, and the agent session resumes the prior conversation rather than starting blank.

**Why this priority**: This is the feature. Without it there is no way to move a live workspace onto a fixed/updated runner image short of destroying and recreating the workspace (losing the session). Everything else supports or surfaces this action.

**Independent Test**: Publish a newer runner image, open a workspace pinned to an older one, invoke "continue onto latest", and confirm: the runner is now on the newer image, the conversation history is intact and the agent responds with prior context, and `/workspace` contents survived.

**Acceptance Scenarios**:

1. **Given** a workspace whose runner is on an older image and a newer image is available, **When** the operator continues onto the latest image, **Then** the runner is recycled onto the newer image, the workspace volume and repositories are preserved, and the agent session continues the prior conversation (a new epoch, not a fresh session).
2. **Given** the runner is already on the latest image, **When** the operator views the workspace, **Then** no upgrade is offered and invoking the action is a no-op that reports "already up to date".
3. **Given** an upgrade is in progress, **When** the operator (or another client) requests it again, **Then** the second request does not start a duplicate upgrade and the operator sees the in-progress state.
4. **Given** the newer image cannot be pulled (unavailable/registry error), **When** an upgrade is attempted, **Then** the workspace is left in a recoverable state with a clear failure reason, and the operator can retry or reconnect to the prior runner.

---

### User Story 2 - See when a runner upgrade is available, in plain terms (Priority: P2)

The operator can tell at a glance whether the workspace's runner is current, and is offered the upgrade only when one is available. The existing "Session setup default@v1 / Runner setup default@v1 / Gen 1" display is not meaningful for image upgrades and is replaced or de-emphasized in favour of a clear runner-image / upgrade-available indicator.

**Why this priority**: The upgrade action is only useful if the operator knows when to use it; the current display actively confuses (it surfaces an internal setup-version/generation scheme the operator cannot act on). Valuable on its own as a clarity fix, but secondary to the action existing.

**Independent Test**: With a workspace on an older image, confirm the UI shows an "upgrade available" indicator and the upgrade control; after upgrading, confirm the indicator clears and shows the runner as current. Confirm the old setup/generation jargon is no longer presented as the primary runner status.

**Acceptance Scenarios**:

1. **Given** a workspace whose runner is behind the latest image, **When** the operator views it, **Then** an "upgrade available" indicator and a continue-onto-latest control are shown.
2. **Given** a workspace whose runner is current, **When** the operator views it, **Then** the runner is shown as up to date with no upgrade control.
3. **Given** any workspace, **When** the operator views runner status, **Then** the primary status is expressed in operator-meaningful terms (current vs upgrade-available), not raw setup-id/version/generation strings.

---

### User Story 3 - Picking up refreshed runner credentials via continue-onto-new-image (Priority: P3)

When runner credentials are refreshed (e.g. a re-authenticated Claude token projected into the runner environment), the operator uses the same continue-onto-latest action to move the workspace onto a freshly provisioned runner that reads the refreshed credentials, while continuing the session. "Restart to pick up new auth" works end to end.

**Why this priority**: This is the operator's stated reason for needing a restart that actually takes effect. It rides on the same recycle-and-continue mechanism as US1; isolating it as P3 keeps US1 shippable on its own.

**Independent Test**: With refreshed credentials available to the runner environment, continue the workspace onto a new runner and confirm the agent authenticates with the refreshed credential (not the stale one) while the prior conversation continues.

**Acceptance Scenarios**:

1. **Given** refreshed runner credentials are available, **When** the operator continues the workspace onto a new runner, **Then** the new runner reads the refreshed credentials and the session continues.
2. **Given** no refreshed credentials are available (none stored yet), **When** the operator continues onto a new runner, **Then** the action still completes and the runner behaves exactly as it does today (no regression), with no false "credentials updated" claim.

### Edge Cases

- No newer image exists → the action is a no-op reporting "already up to date"; no recycle occurs.
- The agent session is actively running (not idle) when an upgrade is requested → the operator is asked to confirm (consistent with the existing restart-and-continue confirmation), and in-flight work is ended at a safe boundary before the recycle.
- The runner is currently scaled down / the workspace is idle → continuing onto the latest image provisions a fresh runner on the latest image directly.
- The image pull fails or the new runner fails to become ready → the upgrade fails cleanly, the workspace is recoverable, and the failure reason is surfaced.
- Concurrent upgrade/connect/restart requests for the same workspace → serialized; only one recycle proceeds.
- The `/workspace` volume must never be deleted by an upgrade (it is preserved across the recycle).
- A workspace with multiple bound agent sessions → all of its sessions continue across the upgrade (each resumes its prior conversation).
- Auto-upgrade must never recycle a runner with connected clients or non-idle agents; an operator actively using a behind-image workspace keeps it until they disconnect/idle or upgrade manually.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST determine whether a workspace's runner is behind the current target runner image by comparing the actual agent-runner image identity (its published release/digest), independent of the agents-api release identity.
- **FR-002**: The system MUST expose an explicit operator action to continue a workspace onto the current target runner image.
- **FR-003**: The system MUST present, per workspace, whether the runner is current or an upgrade is available, in operator-meaningful terms, and MUST offer the continue-onto-latest control only when an upgrade is available.
- **FR-004**: When continuing onto a new image, the system MUST recycle the runner onto the target image such that the newer image is actually run (a stale cached image MUST NOT silently be reused).
- **FR-005**: The upgrade MUST preserve the workspace's persistent contents (`/workspace` and attached repositories); it MUST NOT destroy the workspace volume.
- **FR-006**: The upgrade MUST continue each of the workspace's agent sessions on the new runner — resuming the prior conversation (a new epoch/continuation), not starting a blank session.
- **FR-007**: The newly provisioned runner MUST read the current runner environment, including any refreshed credentials, so that an upgrade is also the supported way to pick up new auth.
- **FR-008**: The action MUST be idempotent/serialized: when the runner is already current it is a no-op reporting "already up to date"; concurrent requests for the same workspace MUST NOT start duplicate recycles.
- **FR-009**: If the upgrade fails (image unavailable, runner not ready), the system MUST leave the workspace in a recoverable state with a clear failure reason, and MUST allow retry.
- **FR-010**: When the agent session is actively running, the system MUST require confirmation before recycling (consistent with the existing restart-and-continue confirmation) and end in-flight work at a safe boundary.
- **FR-011**: The system MUST stop presenting the internal setup-id/version/generation strings as the primary runner status; that scheme MAY remain available as secondary detail but MUST NOT be the operator's main signal for upgradeability.

- **FR-012**: Idle workspaces whose runner is behind the current target image MUST be automatically recycled onto it by the existing idle sweep, but only when it is safe — no connected clients and all agents idle past the existing grace period. Auto-upgrade MUST preserve the workspace volume and MUST NOT interrupt active work; the session resumes on the next connect (or is continued in place) exactly as for an operator-initiated upgrade.

*Deferred / out of scope (recorded, not solved here):*

- The upstream credential-capture problem (the projected runner credential Secret not yet existing because token capture has not populated the store) is out of scope; this feature only ensures a new runner *reads* whatever credentials are present.
- Codex runners are out of scope; Claude only for now.
- The setup-catalog/setup-version model itself is unchanged; only its presentation is addressed.

### Key Entities *(include if feature involves data)*

- **Workspace**: The unit the operator works in; owns a persistent volume and one runner at a time, and one or more agent sessions. Carries which runner image it is currently on and whether an upgrade is available.
- **Runner**: The per-workspace execution environment, provisioned from a runner image. Has an image identity (release/digest) and a readiness state.
- **Runner image (release)**: The published agent-runner artifact. Has an identity (release/digest) that can be compared as current vs behind.
- **Agent session**: A continuing conversation bound to a runner; carries continuity identity (stable session id + epoch) so it can resume across a recycle.
- **Upgrade-available signal**: The per-workspace derived state of "runner is behind the current target image".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After continuing a workspace onto the latest image, the runner is verifiably running the target image identity (release/digest), not the prior one — in 100% of upgrades.
- **SC-002**: After an upgrade, the agent session resumes the prior conversation: the immediately preceding messages are present and the agent answers with prior context, with no loss of `/workspace` contents.
- **SC-003**: The upgrade-available indicator matches reality: it is shown exactly when the runner image is behind the target and clears once the runner is on the target, in 100% of observed cases.
- **SC-004**: A workspace whose runner is already current reports "already up to date" and performs no recycle (no new Pod, no session interruption).
- **SC-005**: A continue-onto-new-image completes (runner ready + session resumed) within a bounded time consistent with a normal cold runner start, and a failed pull/boot leaves the workspace reconnectable to a working runner rather than broken.
- **SC-006**: An operator unfamiliar with the internal setup/generation scheme can correctly tell whether their workspace needs an upgrade from the presented status alone.
- **SC-007**: An idle, behind-image workspace (no clients, agents idle past the grace period) is recycled onto the target image by the sweep without operator action, and a behind-image workspace that is in active use is never recycled out from under the operator.
