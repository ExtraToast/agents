# Feature Specification: Session RBAC / multi-user isolation

**Feature Branch**: `011-session-rbac`
**Created**: 2026-06-12
**Status**: Draft / possible/later
**Input**: Add a possible-later ownership and access-control model for sessions,
workspaces, runners, and durable transcripts if more than one operator uses the
agents console. Depends on spec 002.

## Overview

The current operating model today is a single operator. If the agents console
becomes multi-user, sessions, workspaces, runners, and durable transcripts must
be owned and isolated per user. A user should see and attach only to resources
they own or that have been explicitly shared with them. Operational admins may
need a separate override for support and recovery.

This feature is intentionally scoped as **possible/later**. The immediate
requirement is to avoid blocking that future: spec 002's durable transcript
storage should be shaped so transcripts can be keyed by `owner+session` from
the start, avoiding a later migration if multi-user access becomes real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner-scoped session access (Priority: P1)

An authenticated operator opens the agents console and sees only their own
sessions, workspaces, and runners, plus any sessions explicitly shared with
them. Attaching to a session enforces the same ownership check at the API and
gateway boundary.

**Why this priority**: Ownership isolation is the core requirement. Visibility
filtering alone is insufficient if direct attach URLs can bypass it.

**Independent Test**: Create sessions for two distinct user ids. Verify each user
lists only their own sessions, cannot attach to the other's unshared session, and
can still attach to their own live session.

**Acceptance Scenarios**:

1. **Given** user A owns session A and user B owns session B, **When** user A
   opens the session list, **Then** only session A and explicitly shared sessions
   are returned.
2. **Given** user A attempts to attach to user B's unshared session by direct
   session id, **When** the attach request reaches the gateway/API boundary,
   **Then** the request is rejected and no transcript or live stream is exposed.
3. **Given** user A owns a workspace with a runner and session, **When** user A
   attaches to that session, **Then** the attach succeeds under the same
   single-writer guarantees defined by spec 002.

---

### User Story 2 - Owner-partitioned durable transcripts (Priority: P1)

Durable transcript storage partitions every persisted transcript by owner plus
session. Restarting a runner or replaying history reads only the transcript for
the authorized owner/session pair.

**Why this priority**: Spec 002 introduces durable storage. If storage is keyed
only by session id, later multi-user isolation may require a migration and
raises the risk of accidental cross-owner transcript access.

**Independent Test**: Persist transcripts for two owners with distinct sessions,
restart both runners, and verify each replay resolves the owner/session-scoped
transcript and never reads another owner's data.

**Acceptance Scenarios**:

1. **Given** a session owned by user A, **When** transcript output is persisted,
   **Then** the storage identity includes user A's owner key and the stable
   session id.
2. **Given** user B knows user A's session id, **When** user B requests replay or
   attach, **Then** the system does not resolve user A's persisted transcript.
3. **Given** a runner restarts for a session, **When** history is replayed,
   **Then** the replay uses the session owner claim plus session id, not the
   session id alone.

---

### User Story 3 - Admin override for operations (Priority: P2)

An operator with an admin claim can inspect or attach to a session outside their
own ownership scope for support, recovery, or incident response. The override is
explicit and auditable.

**Why this priority**: Operations may need a controlled escape path, but it must
not weaken default owner isolation.

**Independent Test**: Attempt the same cross-owner access as a normal user and
as an admin. The normal user is rejected; the admin succeeds only through the
admin override path and the override is visible in audit data.

**Acceptance Scenarios**:

1. **Given** a session owned by user A, **When** a non-admin user B attempts to
   attach, **Then** access is denied.
2. **Given** the same session, **When** an admin uses the override, **Then**
   access is allowed and the override records admin identity, target owner,
   target session, action, and timestamp.

---

### User Story 4 - Explicit session sharing or handoff (Priority: P3)

An owner can explicitly share a session with another user, or hand off ownership,
so collaborative or transfer workflows do not require admin override.

**Why this priority**: Sharing is useful if multi-user usage appears, but it can
remain optional until real collaboration requirements are confirmed.

**Independent Test**: Grant user B access to user A's session, verify user B can
list and attach to the shared session, then revoke access and verify user B can
no longer list or attach.

**Acceptance Scenarios**:

1. **Given** user A owns a session, **When** user A shares it with user B,
   **Then** user B can see and attach to that shared session.
2. **Given** user A revokes the share, **When** user B refreshes or attempts a
   direct attach, **Then** the session is no longer visible or attachable.
3. **Given** ownership is handed off, **When** the handoff completes, **Then**
   the new owner becomes the owner used for list, attach, runner, and transcript
   authorization.

### Edge Cases

- Multi-user may never become part of the product; the owner key still needs a
  stable default for the single-operator case so spec 002 storage can use the
  same owner/session shape from day one.
- Missing or malformed `X-User-Id` from forward-auth must fail closed for
  owner-scoped APIs and attach paths.
- A user id changes upstream; the ownership model needs either a stable
  immutable subject or a documented remapping process.
- A session is shared while a restart/replay is in progress; attach and replay
  checks must use one consistent authorization decision per request.
- A share is revoked while another user is attached; the expected disconnect
  behavior is [NEEDS CLARIFICATION: immediate disconnect vs deny future attach].
- Admin override during an incident must not change ownership unless a separate
  handoff action is requested.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each workspace, runner, durable session, and persisted transcript
  MUST have a session-owner claim derived from the authenticated user.
- **FR-002**: The system MUST reuse the existing SSO/forward-auth integration and
  `X-User-Id` as the source input for deriving the session-owner claim.
- **FR-003**: List/read APIs MUST return only resources owned by the requesting
  owner or explicitly shared with that owner, unless an admin override is used.
- **FR-004**: Attach, input, restart, replay, rename, stop, delete, and archive
  actions MUST enforce ownership or explicit share authorization at the
  server/gateway boundary, not only in the UI.
- **FR-005**: The attach guard from spec 002 MUST enforce owner authorization in
  addition to single-writer/session-id locking.
- **FR-006**: Durable transcript storage introduced by spec 002 MUST be
  partitioned and resolved by owner plus stable session id, not by session id
  alone.
- **FR-007**: Runner lifecycle operations MUST preserve and validate the owner
  claim when starting, restarting, reattaching, or replaying a session.
- **FR-008**: Missing owner identity MUST fail closed for owner-scoped APIs and
  attach/replay paths.
- **FR-009**: Admin override MUST be explicit, authorization-gated, and
  auditable with actor, target owner, target session, action, and timestamp.
- **FR-010**: Explicit sharing and handoff MAY be added if multi-user usage is in
  scope; when present, those grants MUST be checked by the same list/action/
  attach/replay authorization paths as owner checks.
- **FR-011**: Existing single-operator behavior MUST continue to work with a
  stable default owner value.
- **FR-012**: The implementation plan MUST resolve [NEEDS CLARIFICATION:
  whether multi-user access is actually in scope yet, and what upstream identity
  value is stable enough to store as the owner key].

### Key Entities *(include if feature involves data)*

- **Session owner**: Stable identity claim derived from authenticated user
  context; used to authorize sessions, workspaces, runners, and transcript
  storage.
- **Owned workspace**: Workspace record associated with exactly one owner unless
  shared or handed off.
- **Owned runner**: Live runner/pod association tied to the workspace/session
  owner and validated on lifecycle and attach operations.
- **Owned durable session**: Stable session id plus owner claim, lifecycle state,
  epoch, and sharing metadata.
- **Persisted transcript partition**: Durable transcript path or record keyed by
  owner plus session id, bounded and replayable per spec 002.
- **Share grant**: Optional explicit permission allowing another owner to list,
  attach, or otherwise act on a session according to grant scope.
- **Admin override record**: Audit record for authorized cross-owner access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a two-user test, each non-admin user sees 0 sessions owned only
  by the other user.
- **SC-002**: Direct attach/replay/input attempts against another user's
  unshared session are denied 100% of the time at the server/gateway boundary.
- **SC-003**: Durable transcript replay for restarted sessions resolves by
  owner plus session id; tests prove another owner cannot retrieve the
  transcript with session id alone.
- **SC-004**: Admin override succeeds only for authorized admins and produces an
  audit record for every cross-owner action.
- **SC-005**: Single-operator deployments continue to create, list, restart,
  attach, replay, and stop sessions without adding manual user-selection steps.

## Assumptions

- The current deployment has one operator, so full multi-user UX and sharing can
  remain deferred.
- Forward-auth already supplies `X-User-Id` to protected API calls; this feature
  maps that header to the persisted owner claim once multi-user isolation is in
  scope.
- Spec 002 can shape durable transcript keys as `owner+session` without
  requiring full RBAC implementation immediately.
- The owner claim should be an opaque stable subject, not a display name or
  email, but the exact upstream field is unresolved.

## Non-Goals

- Building full multi-user account management before a second operator exists.
- Replacing the existing SSO/forward-auth boundary.
- Broad group/role administration beyond owner, explicit share, and admin
  override semantics.
- Cross-cluster transcript replication or disaster recovery beyond spec 002's
  durable storage scope.
- Retrofitting unrelated chat-only session behavior unless it shares the same
  durable session/runner/transcript surface.

## Open Questions

- Is multi-user access actually in scope, or should this remain only a storage
  layout precaution while the deployment is single-operator?
- Which upstream identity value should become the stable session-owner key from
  `X-User-Id`?
- Should share revocation disconnect already-attached users immediately, or only
  prevent future attach/replay/input requests?
- What role or claim identifies admins allowed to use the override path?
