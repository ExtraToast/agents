# Tasks: Route Shell Foundation

**Input**: Route shell specification from `/specs/022-route-shell-foundation/spec.md`
**Prerequisites**: `specs/016-scaffold-ci-workspace/spec.md`; auth guard contract alignment with the native auth token bridge slice

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel because it touches different files or only reads source context
- Implementation tasks preserve the ownership rule that shell work touches `services/agents-ui/src/router/**` and feature slices add only `services/agents-ui/src/features/<name>/routes.ts`

## Phase 1: Baseline Verification

- [ ] T001 Verify `services/agents-ui` remains the selected app package from the scaffold
- [ ] T002 Inspect the current `services/agents-ui/src/router/index.ts` and record existing routes that must move behind the route shell
- [ ] T003 Inspect existing `services/agents-ui/src/features/` folders and identify any current feature routes or navigation links
- [ ] T004 Verify the app shell navigation source and note labels, sections, and icons that must be preserved
- [ ] T005 Verify the auth bridge exposes or plans a guard-facing auth restoration and capability query contract

## Phase 2: Frozen Route Shell Interfaces

- [ ] T006 Define `FeatureRouteModule` in a shell-owned file under `services/agents-ui/src/router/`
- [ ] T007 Define typed route meta with `requiresAuth`, `adminCapability`, and nav visibility support under `services/agents-ui/src/router/`
- [ ] T008 Define `AdminCapability` and the guard-facing capability check type under `services/agents-ui/src/router/`
- [ ] T009 Define the `NavigationItem` schema with `id`, `label`, `to`, `section`, optional `order`, optional `icon`, and auth/admin visibility fields
- [ ] T010 Export the route shell types from one stable shell-owned module for downstream feature route modules

## Phase 3: Route Discovery

- [ ] T011 Add the shell-owned route-discovery module under `services/agents-ui/src/router/`
- [ ] T012 Implement static discovery for `services/agents-ui/src/features/*/routes.ts` route modules
- [ ] T013 Normalize discovered modules into deterministic order by feature name and route order
- [ ] T014 Validate each route module for required `feature`, route records, and supported route metadata
- [ ] T015 Reject duplicate route names and duplicate sibling paths during route manifest assembly
- [ ] T016 Reject duplicate navigation item IDs during navigation manifest assembly
- [ ] T017 Enforce that any `adminCapability` route is authenticated and fails closed when capabilities are unknown

## Phase 4: Router Assembly And Guards

- [ ] T018 Update `services/agents-ui/src/router/index.ts` to assemble routes from shell base routes and discovered feature modules
- [ ] T019 Install the protected-route guard that restores auth before evaluating `requiresAuth` routes
- [ ] T020 Preserve the attempted destination when redirecting unauthenticated users to the login route
- [ ] T021 Install admin-capability denial for protected routes when the restored user lacks the required capability
- [ ] T022 Ensure public auth routes do not trigger auth restoration loops

## Phase 5: Navigation Assembly

- [ ] T023 Build shell navigation from discovered feature module `navigation` arrays
- [ ] T024 Sort navigation entries by section, `order`, and stable ID
- [ ] T025 Filter navigation entries with the same auth/admin semantics used by direct route guards
- [ ] T026 Preserve route reachability for routes intentionally hidden from navigation

## Phase 6: Tests

- [ ] T027 Add route-discovery tests with two fixture feature modules that require no shared router edits
- [ ] T028 Add validation tests for duplicate route names, duplicate sibling paths, duplicate navigation IDs, and malformed modules
- [ ] T029 Add guard tests for unknown auth state, successful restoration, failed restoration, and preserved redirect destination
- [ ] T030 Add admin-capability tests for allowed admin access, non-admin denial, and unknown-capability fail-closed behavior
- [ ] T031 Add navigation tests for anonymous, authenticated non-admin, and admin users
- [ ] T032 Add type-level or compile coverage proving downstream modules can import the frozen route shell types

## Phase 7: Downstream Handoff

- [ ] T033 Document in the implementation PR that downstream feature slices add only `services/agents-ui/src/features/<name>/routes.ts`
- [ ] T034 Confirm auth, signup, account, admin, and session feature specs reference `FeatureRouteModule` instead of editing `services/agents-ui/src/router/index.ts`
- [ ] T035 Confirm no feature-owned task claims ownership of `services/agents-ui/src/router/**`

## Phase 8: Acceptance Verification

- [ ] T036 Run `pnpm --filter @extratoast/agents-ui typecheck`
- [ ] T037 Run `pnpm --filter @extratoast/agents-ui test`
- [ ] T038 Run `pnpm --filter @extratoast/agents-ui lint`
- [ ] T039 Verify a sample feature route module can be added without editing `services/agents-ui/src/router/index.ts`
- [ ] T040 Verify protected deep links restore auth before redirecting or allowing navigation

## Dependencies

- T001 through T005 precede interface and implementation work because the current router, navigation, and auth bridge shape must be verified first.
- T006 through T010 precede all downstream feature route modules.
- T011 through T017 precede T018 because router assembly consumes the discovered manifest.
- T018 through T022 precede downstream protected feature routes.
- T023 through T026 depend on the discovered route module shape from T011 through T017.
- T027 through T032 validate the foundation before downstream fan-out begins.
- T033 through T035 are the handoff gate before auth, signup, account, admin, and session slices add routes.
- T036 through T040 run after implementation and before merge.

## Downstream Handoff

- Auth, signup, account, admin, and session feature slices register screens through `services/agents-ui/src/features/<name>/routes.ts`.
- Feature slices import frozen route shell types but do not edit `services/agents-ui/src/router/**`.
- Protected feature routes use `requiresAuth` and `adminCapability` route metadata instead of installing feature-local router guards.
- Navigation entries live beside routes in each feature route module and are filtered by the shell.

## Parallel Example

```text
T002 [P] Inspect current router
T003 [P] Inspect feature folders
T004 [P] Verify navigation source
T005 [P] Verify auth bridge contract
```

```text
T027 [P] Add route-discovery tests
T028 [P] Add validation tests
T031 [P] Add navigation tests
```
