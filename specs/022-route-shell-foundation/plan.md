# Implementation Plan: Route Shell Foundation

**Branch**: `022-route-shell-foundation` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-route-shell-foundation/spec.md`

## Summary

Define the shell-owned route system for the accounts + agents app: a `FeatureRouteModule` convention at `src/features/<name>/routes.ts`, static route-module discovery, typed auth/admin route meta, navigation item assembly, and guards that restore auth before protected-route decisions. The implementation must eliminate shared router-file fan-out before downstream feature slices begin.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x
**Primary Dependencies**: Vue Router, Vite static glob imports, existing agents-ui app shell
**Storage**: N/A
**Testing**: Vitest/router unit tests; downstream Playwright checks for protected deep links
**Target Platform**: Web, Android, and iOS through the Capacitorized Vue app
**Project Type**: Vue UI shell
**Performance Goals**: Route discovery is build-time/static and adds no runtime network dependency
**Constraints**: `services/agents-ui` is the selected app package from `specs/016-scaffold-ci-workspace/`; feature slices only add `src/features/<name>/routes.ts`; auth implementation is supplied by the native auth token bridge slice
**Scale/Scope**: One shell router foundation, one discovery module, route/nav type contracts, guard installation, and focused tests

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Agent-facing behavior is not changed by this documentation-only spec
- [x] Rendered artifacts are not applicable
- [x] Small stacked PR boundary is clear and unrelated cleanup is excluded
- [x] Verification command is identified for the future implementation area

## Project Structure

### Documentation

```text
specs/022-route-shell-foundation/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Existing Context

```text
specs/013-native-target-adr/spec.md
specs/016-scaffold-ci-workspace/spec.md
```

The native auth token bridge slice is a predecessor for concrete auth implementation, but this route-shell spec may define the guard-facing auth restoration contract so feature route metadata can be frozen.

### Implementation Ownership

```text
services/agents-ui/src/router/**
services/agents-ui/src/features/*/routes.ts
```

The route shell foundation owns `services/agents-ui/src/router/**` and the route-discovery module. Downstream feature slices own only their own `services/agents-ui/src/features/<name>/routes.ts` route registration files.

**Structure Decision**: Keep route assembly in the selected `services/agents-ui` package. Replace the current conventional shared router table with shell-owned auto-discovery so downstream feature specs do not co-edit `src/router/index.ts`.

## Phase 0: Baseline Verification

1. Verify the selected app package from the scaffold remains `services/agents-ui`.
2. Inspect the current `services/agents-ui/src/router/index.ts` shape before implementation.
3. Inspect existing feature folder names under `services/agents-ui/src/features/` to choose fixture route module locations.
4. Confirm whether any existing navigation source already supplies sections, labels, or icons that must be preserved.
5. Confirm the auth bridge exposes, or will expose, a guard-facing restore function and user capability query.

**Gate**: Do not implement route discovery until the current router and navigation entry points are verified in the real source tree.

## Phase 1: Frozen Interfaces

Define shell-owned TypeScript interfaces for:

```ts
type AdminCapability = string

interface AppRouteMeta {
  requiresAuth?: boolean
  adminCapability?: AdminCapability
  hideFromNav?: boolean
}

interface NavigationItem {
  id: string
  label: string
  to: RouteLocationRaw
  section: string
  order?: number
  icon?: string
  requiresAuth?: boolean
  adminCapability?: AdminCapability
}

interface FeatureRouteModule {
  feature: string
  routes: RouteRecordRaw[]
  navigation?: NavigationItem[]
}
```

Implementation may refine exact imports and readonly modifiers, but downstream feature specs must treat these names and fields as the stable contract.

**Gate**: `FeatureRouteModule`, route meta, navigation item, and guard hook types are exported from shell-owned files before any feature slice adds routes.

## Phase 2: Route Discovery

1. Add a shell-owned route-discovery module under `services/agents-ui/src/router/`.
2. Use a static Vite glob/import pattern for `../features/*/routes.ts`.
3. Normalize discovered modules into deterministic order by feature name and route order.
4. Validate each discovered module for required `feature`, route records, duplicate route names, duplicate sibling paths, duplicate navigation IDs, and admin metadata rules.
5. Return a route manifest containing routes and navigation entries for router creation and app shell navigation.

**Gate**: Unit tests prove two independent feature route modules can be discovered without editing `src/router/index.ts`.

## Phase 3: Router Assembly And Guards

1. Keep `src/router/index.ts` shell-owned.
2. Create the router from shell base routes plus discovered feature routes.
3. Install guards that call the auth restoration hook before evaluating `requiresAuth` or `adminCapability`.
4. Redirect unauthenticated protected-route navigation to the login route while preserving the attempted destination.
5. Deny admin-capability navigation when the restored user lacks the required capability.
6. Avoid auth restoration loops on public auth routes.

**Gate**: Guard tests cover unknown auth state, restored auth state, failed restore, admin allow, admin deny, and public route behavior.

## Phase 4: Navigation Assembly

1. Build navigation from feature module `navigation` arrays.
2. Sort navigation by section, `order`, and stable ID.
3. Filter navigation using the same auth/admin metadata semantics as direct route access.
4. Prefer named route locations for navigation `to` values.
5. Keep route reachability independent from nav visibility.

**Gate**: Navigation tests cover anonymous, authenticated non-admin, and admin users.

## Phase 5: Downstream Handoff

Downstream feature specs must:

1. Import only the frozen route shell types.
2. Add `src/features/<name>/routes.ts` for route registration.
3. Avoid editing `src/router/**`.
4. Use `requiresAuth` and `adminCapability` route metadata rather than feature-local guard logic.
5. Provide navigation entries only through their feature route module.

## Phase 6: Verification

Run after implementation:

```bash
pnpm --filter @extratoast/agents-ui typecheck
pnpm --filter @extratoast/agents-ui test
pnpm --filter @extratoast/agents-ui lint
```

The implementation PR should also include focused Vitest coverage for route discovery, duplicate validation, auth restoration guards, admin capability denial, and navigation filtering.

## Risks And Mitigations

- **Auth bridge timing**: Keep the guard-facing auth restoration contract narrow so the route shell can compile against a stable interface while auth implementation evolves behind it.
- **Glob typing drift**: Wrap Vite glob output in one discovery module and validate exports at the boundary.
- **Hidden merge conflicts**: Make `src/router/**` shell-owned and route module files feature-owned in downstream specs.
- **Navigation duplication**: Require stable navigation IDs and route-name-based links where available.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Baseline verification plan complete
- [x] Phase 1: Frozen interfaces specified
- [x] Phase 2: Route discovery specified
- [x] Phase 3: Guard model specified
- [x] Phase 4: Navigation assembly specified
- [x] Phase 5: Downstream handoff specified

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved

## Verification

```bash
test -f specs/022-route-shell-foundation/spec.md \
  && test -f specs/022-route-shell-foundation/plan.md \
  && test -f specs/022-route-shell-foundation/tasks.md \
  && grep -qi 'routes.ts\|FeatureRouteModule\|route module' specs/022-route-shell-foundation/spec.md
```
