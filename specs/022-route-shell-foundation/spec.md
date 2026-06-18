# Feature Specification: Route Shell Foundation

**Feature Branch**: `022-route-shell-foundation`
**Created**: 2026-06-16
**Status**: Draft
**Input**: Spec the conflict-free route skeleton for the Capacitorized accounts + agents app.

## Decision

The app shell will replace the current single shared router table pattern with a feature-owned route module convention. The shell owns `src/router/**` and one route-discovery module. Feature slices own only their own `src/features/<name>/routes.ts` files and register routes, route metadata, and navigation entries through the frozen `FeatureRouteModule` interface.

The route-discovery module auto-aggregates every feature route module with a static glob/import mechanism supported by the Vue/Vite build. Downstream feature agents must not edit `src/router/index.ts`, shared route arrays, or shared navigation registries. The Phase-2 vertical slice freezes these interfaces before auth, signup, account, admin, session, and mobile fan-out work begins.

## User Scenarios & Testing

### User Story 1 - Conflict-Free Feature Routes (Priority: P1)

A feature implementer can add a new screen by creating `src/features/<name>/routes.ts` without editing a shared router file.

**Why this priority**: Route-table fan-out is the highest merge-conflict risk for parallel feature slices.

**Independent Test**: Add two fixture feature route modules in separate feature folders, run the router discovery tests, and verify both modules contribute routes without shared-file edits.

**Acceptance Scenarios**:

1. **Given** a feature slice adds `src/features/auth/routes.ts`, **When** the app builds, **Then** the shell discovers the auth route module without a manual import in `src/router/index.ts`.
2. **Given** two feature slices add route modules in parallel, **When** their branches merge, **Then** no shared router or navigation source file has to be reconciled for route registration.
3. **Given** a feature route module exports malformed route metadata, **When** route discovery runs in tests, **Then** the module fails fast with a useful validation error.

---

### User Story 2 - Protected Route Guard Restoration (Priority: P1)

An authenticated user can deep-link into a protected feature route, and the app restores authentication state before deciding whether to allow, redirect, or deny navigation.

**Why this priority**: Native and web auth flows depend on protected routes not racing before session restoration completes.

**Independent Test**: Simulate a cold app start to a protected route with a restorable session and verify the guard waits for auth restoration before resolving navigation.

**Acceptance Scenarios**:

1. **Given** a route has `meta.requiresAuth: true` and auth state is unknown, **When** navigation starts, **Then** the guard invokes the shell auth restoration hook before making an allow or redirect decision.
2. **Given** auth restoration succeeds for the current user, **When** the protected route is requested, **Then** navigation continues to the requested route.
3. **Given** auth restoration fails, **When** the protected route is requested, **Then** navigation redirects to the registered login route with the attempted destination preserved.

---

### User Story 3 - Capability-Aware Navigation (Priority: P2)

The app shell can build navigation from feature route modules while hiding entries the current user cannot access.

**Why this priority**: Account, admin, signup, and agents screens must share one navigation model without feature slices editing shell navigation.

**Independent Test**: Register public, authenticated, and admin-capability navigation entries and verify the shell filters entries for anonymous, regular, and admin users.

**Acceptance Scenarios**:

1. **Given** a route module includes navigation items, **When** the shell builds the app navigation, **Then** items are sorted by section/order and linked to named routes.
2. **Given** a navigation item requires an admin capability the user does not have, **When** navigation is rendered, **Then** the item is hidden and direct route access is denied.
3. **Given** a route has no navigation item, **When** route discovery runs, **Then** the route remains reachable by name/path but does not appear in primary navigation.

### Edge Cases

- Route modules discovered in an undefined filesystem order must still produce stable route and navigation ordering.
- Duplicate route names, duplicate route paths at the same nesting level, and duplicate navigation IDs must fail in tests before merge.
- Admin-capability routes must fail closed when the current user's capabilities are unknown.
- Public routes, such as login or password-reset return routes, must not trigger an infinite auth-restore loop.
- Feature modules may define child routes, but parent layout ownership must remain explicit in the module rather than patched into the shell router later.

## Requirements

### Functional Requirements

- **FR-001**: The shell MUST define and freeze a `FeatureRouteModule` interface consumed by every feature route module.
- **FR-002**: Each feature route module MUST live at `src/features/<name>/routes.ts` and MUST be the only file a feature slice edits for route registration.
- **FR-003**: The shell MUST auto-discover feature route modules through a static glob/import mechanism in a route-discovery module owned with `src/router/**`.
- **FR-004**: `src/router/index.ts` MUST assemble the router from discovered modules and shell-owned base routes only; downstream feature specs MUST NOT edit it.
- **FR-005**: `FeatureRouteModule.routes` MUST accept Vue Router route records with typed route meta.
- **FR-006**: Route meta MUST support `requiresAuth?: boolean`, `adminCapability?: AdminCapability`, and an optional navigation policy marker for routes that must not appear in nav.
- **FR-007**: Admin-gated routes MUST require `requiresAuth: true` either explicitly or by validation derived from `adminCapability`.
- **FR-008**: The shell MUST define a navigation item schema with stable `id`, `label`, `to`, `section`, optional `order`, optional `icon`, and optional auth/admin visibility constraints.
- **FR-009**: Navigation entries MUST reference named routes or typed route locations, not raw duplicated path strings when a route name is available.
- **FR-010**: Router guards MUST restore auth state before evaluating any route with `requiresAuth` or `adminCapability`.
- **FR-011**: Router guards MUST preserve the attempted destination when redirecting an unauthenticated user to login.
- **FR-012**: Router guards MUST deny admin-capability routes when auth is restored but the current user lacks the required capability.
- **FR-013**: Route discovery tests MUST validate stable ordering, duplicate route names, duplicate navigation IDs, required auth metadata, and admin capability enforcement.
- **FR-014**: The Phase-2 vertical slice MUST freeze the `FeatureRouteModule`, route meta, navigation item, and guard hook interfaces before feature fan-out begins.

### Key Entities

- **FeatureRouteModule**: Feature-owned registration object exported from `src/features/<name>/routes.ts`; includes routes and optional navigation items.
- **Route meta**: Shell-owned typed Vue Router metadata for auth restoration, admin capability checks, and navigation policy.
- **AdminCapability**: Shell-owned capability identifier used by guards and navigation filtering for admin-only routes.
- **Navigation item**: Feature-provided shell navigation entry derived from a route module and filtered by auth/capability state.
- **Route discovery module**: Shell-owned static import/glob aggregator that loads feature route modules and validates the merged route manifest.
- **Auth restoration hook**: Shell/auth interface used by router guards to resolve unknown session state before protected-route decisions.

## File Ownership Rules

- `src/router/**`: owned by this route shell foundation. It contains router creation, route discovery, route metadata types, navigation registry assembly, guard installation, and tests for those behaviors.
- `src/features/<name>/routes.ts`: owned by each feature slice. Feature slices add or update only their own route module.
- `src/features/**` files other than `routes.ts`: feature implementation ownership; they must not import shell internals except the frozen route/navigation types.
- Shared navigation arrays, manual imports in `src/router/index.ts`, and feature-owned edits to shell guard code are forbidden after this interface lands.
- Auth implementation details are owned by the native auth token bridge slice; this spec owns only the guard contract that asks auth to restore and report user capabilities.

## Non-Goals

- Implementing login, signup, account, or admin screens.
- Defining backend auth or account API contracts.
- Replacing the native auth token lifecycle specified by the native auth token bridge slice.
- Changing feature-specific view components beyond route-module registration.

## Success Criteria

- **SC-001**: A new feature route can be added by creating one `src/features/<name>/routes.ts` file with no edits to shared router files.
- **SC-002**: The merged route manifest is deterministic and rejects duplicate route names and duplicate navigation IDs in tests.
- **SC-003**: Protected deep links restore auth before redirecting or allowing access.
- **SC-004**: Admin-only navigation and direct route access fail closed for users without the required capability.
- **SC-005**: The frozen route-module interfaces are referenced by downstream feature specs before they define routes.
