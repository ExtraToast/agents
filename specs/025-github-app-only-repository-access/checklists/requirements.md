# Requirements Quality Checklist — GitHub App-only repository access

Validates `spec.md` for completeness, testability, and bounded scope before
planning. Each item: PASS / FAIL / N/A.

## Completeness

- [x] Problem and motivation stated (why deploy keys are now redundant). — PASS
- [x] User stories cover the full journey: add repo, verify access, cleanup. — PASS
- [x] Edge cases enumerated (un-installable owner, unparseable URL, repo
  excluded from installation, legacy/SSH repos, rate limiting). — PASS
- [x] Non-goals explicit. — PASS
- [x] Assumptions explicit. — PASS
- [x] Open questions captured with pointers to the FRs they affect. — PASS

## Testability & Measurability

- [x] Each user story has an independent test. — PASS
- [x] Acceptance scenarios are Given/When/Then and observable. — PASS
- [x] Success criteria are measurable and outcome-based (e.g. "0 credential
  fields in add flow", "100% of links resolve to the current App"). — PASS
- [x] Status states are enumerable and distinguishable (able / not-able /
  indeterminate). — PASS

## Bounded Scope

- [x] Scope limited to GitHub-only, App-only access; non-GitHub and permission
  changes excluded. — PASS
- [x] Backward compatibility constraint stated (existing/SSH/legacy repos keep
  working with no user re-setup). — PASS
- [x] v1 boundary drawn (manual re-check acceptable; no auto-detect callback). — PASS

## Implementation-Detail Leakage

- [x] Requirements describe outcomes, not code structure. — PASS (file/class
  names live only in the Context narrative and the planning input, not in FRs.)
- [x] No mandated tech stack or API shapes in FRs. — PASS

## Outstanding

- [x] OQ-1 data cleanup strategy (FR-009) — RESOLVED: drop columns + best-effort
  delete stored keys during migration.
- [x] OQ-2 legacy link retirement vs read-only (FR-010) — RESOLVED: keep
  read-only, strip key fields, no migration into unified model.
- [x] OQ-3 status refresh UX — RESOLVED: manual re-check, no polling.
- [x] OQ-4 un-installable-owner detection — RESOLVED: generic message + install
  link.

**Verdict**: Spec is complete, testable, and fully resolved — no outstanding
`[NEEDS CLARIFICATION]` markers. Ready for `/speckit.plan`.
