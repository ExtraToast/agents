**Implementation Plan**

1. Write the spec in `specs/013-repair-session-runner-boot/spec.md` using the repo's Spec Kit script.
2. Add the boot lease schema, domain fields, repository guards, setup target resolver extraction, readiness classifier, lifecycle service, and publisher port.
3. Wire workspace create and connect to the lifecycle service with explicit post-commit/outside-transaction boot.
4. Refactor session binding and all bind consumers so unavailable readiness is returned before session persistence or generation changes.
5. Update non-session guards, maintenance, idle sweep, and Kubernetes integration tests for the new boot/readiness model.
6. Stabilize SSE and add workspace-scoped runner readiness events only through a server-filtered endpoint.
7. Regenerate contracts.
8. Update the UI workspace open/connect/readiness model, explicit start de-dup, retry allowlist, and native EventSource reconnect state.
9. Add E2E coverage and run full validation.
