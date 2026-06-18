# Tasks: Native Networking and Origins

**Input**: Design documents from `/specs/018-native-networking-origins/`
**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), backend milestones from `specs/014-backend-gaps-program/`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files.
- **[Story]**: User story label from [spec.md](./spec.md).
- Tests are listed before implementation where they define the expected behavior.

## Phase 1: Setup and Evidence

- [x] T001 [P] Verify current agents API base URL in `services/agents-ui/src/lib/vueWebCommons.ts`
- [x] T002 [P] Verify current status stream URL behavior in `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts`
- [x] T003 [P] Verify current chat stream URL behavior in `services/agents-ui/src/features/sessions/services/chatSessionsService.ts`
- [x] T004 [P] Verify current WS host rewrite in `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`
- [x] T005 [P] Verify current backend `X-User-Id` and WS origin behavior in `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/config/SecurityConfig.kt` and `services/agents-api/src/main/kotlin/com/jorisjonkers/personalstack/agents/infrastructure/ws/WebSocketConfig.kt`
- [x] T006 [P] Verify generated OpenAPI files contain legitimate `/api/v1` paths and must be excluded from feature-owned static literal tests

## Phase 2: Foundation - Runtime Origin Layer

**Goal**: Add the shared primitives every story uses.

**Independent Test**: Focused Vitest tests prove origin parsing, URL building, credential policy selection, and static literal guards before services are migrated.

- [ ] T007 [P] Add env declarations for `VITE_AUTH_ORIGIN`, `VITE_AGENTS_API_ORIGIN`, and `VITE_AGENTS_WS_ORIGIN` in `services/agents-ui/env.d.ts`
- [ ] T008 [P] Add origin parser tests in `services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts` covering valid origins, trailing slash normalization, rejected path/query/hash values, rejected wrong schemes, and missing production config
- [ ] T009 [P] Add URL builder tests in `services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts` covering agents API base, auth current-user URL, sessions events URL, chat stream URL, WS attach URL, encoded IDs, attach-token query, and epoch/offset query preservation
- [ ] T010 [P] Add credential policy tests in `services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts` for `web-cookie` and `native-bearer` REST, chat stream, status stream, and WS attach behavior
- [ ] T011 Implement `RuntimeOrigins`, `AuthOrigin`, `AgentsApiOrigin`, `AgentsWsOrigin`, `UrlBuilder`, and `CredentialsModePolicy` in `services/agents-ui/src/lib/runtimeOrigins.ts`
- [ ] T012 Preserve `VITE_AUTH_URL` as a temporary alias for existing web auth config in `services/agents-ui/src/lib/runtimeOrigins.ts`, while preferring `VITE_AUTH_ORIGIN`

## Phase 3: User Story 1 - Resolve Absolute Runtime Origins (Priority: P1)

**Goal**: REST, SSE/chat stream, and WebSocket URLs come from configured origins, not same-origin paths or page host discovery.

**Independent Test**: Stub env origins and assert all migrated services use absolute URLs under `capacitor://localhost` and normal web origins.

- [ ] T013 [US1] Update `services/agents-ui/src/lib/vueWebCommons.ts` so auth and agents API base URLs use `RuntimeOrigins` and `UrlBuilder`
- [ ] T014 [US1] Update default API service helpers in `services/agents-ui/src/features/workspaces/services/workspaceService.ts`, `services/agents-ui/src/features/projects/services/projectsService.ts`, and `services/agents-ui/src/features/repositories/services/repositoriesService.ts` to avoid feature-owned `baseUrl: '/api/v1'`
- [ ] T015 [US1] Update `services/agents-ui/src/features/workspaces/components/OpenPrButton.vue` to use the common agents API base behavior instead of a local `baseUrl: '/api/v1'`
- [ ] T016 [US1] Update `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` to build `sessionsEventsUrl()` from `UrlBuilder`
- [ ] T017 [US1] Update `services/agents-ui/src/features/sessions/services/chatSessionsService.ts` to build chat stream URLs from `UrlBuilder.chatMessageStreamUrl(id)`
- [ ] T018 [US1] Update `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` to build WS attach URLs from `UrlBuilder.sessionAttachWsUrl()` and remove the `window.location.host` `agents.` to `agents-ws.` rewrite
- [ ] T019 [US1] Update `services/agents-ui/src/features/workspaces/__tests__/sessionStatusStream.test.ts` and `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts` to assert configured absolute URLs

## Phase 4: User Story 2 - Apply Credentials by Transport Mode (Priority: P1)

**Goal**: Web cookie mode and native bearer mode produce correct request options without duplicating auth logic in feature services.

**Independent Test**: In service tests, cookie mode includes credentials/CSRF and bearer mode sends Authorization without cookies or `X-User-Id`.

- [ ] T020 [US2] Add a token-provider interface consumed by `CredentialsModePolicy` in `services/agents-ui/src/lib/runtimeOrigins.ts`; leave native secure token storage to the native auth spec
- [ ] T021 [US2] Update `services/agents-ui/src/lib/vueWebCommons.ts` to pass credentials, CSRF, and Authorization behavior from `CredentialsModePolicy`
- [ ] T022 [US2] Update `services/agents-ui/src/features/sessions/services/chatSessionsService.ts` so chat stream fetch options come from `CredentialsModePolicy.streamRequestInit()`
- [ ] T023 [US2] Add chat stream service tests under `services/agents-ui/src/features/sessions/__tests__/` for cookie mode, bearer mode, missing bearer token failure, and no client-sent `X-User-Id`
- [ ] T024 [US2] Update `services/agents-ui/src/features/workspaces/services/sessionStatusStream.ts` to keep standard `EventSource` only when the policy supports browser credentials and to use a bearer-capable fetch-SSE path for native bearer mode
- [ ] T025 [US2] Add status stream tests in `services/agents-ui/src/features/workspaces/__tests__/sessionStatusStream.test.ts` for cookie `EventSource` and bearer fetch-SSE behavior
- [ ] T026 [US2] Update `services/agents-ui/src/features/workspaces/services/sessionSocket.ts` so attach-token query support is available without placing long-lived bearer tokens in the WS URL
- [ ] T027 [US2] Add socket tests in `services/agents-ui/src/features/workspaces/__tests__/sessionSocket.test.ts` proving attach-token, epoch, and offset query composition

## Phase 5: User Story 3 - Preserve the Trusted Edge/Auth Boundary (Priority: P1)

**Goal**: Client code cannot regress into spoofable identity headers, feature-owned `/api/v1` literals, or backend host discovery.

**Independent Test**: Static Vitest or lint gate fails on intentionally introduced forbidden literals in feature-owned source.

- [ ] T028 [US3] Add `services/agents-ui/src/__tests__/nativeNetworkingStatic.test.ts` to scan `src/features/**/*.{ts,vue}` and relevant `src/lib` callers for forbidden backend literals and host discovery
- [ ] T029 [US3] Exclude `services/agents-ui/src/api/generated.ts`, Playwright/e2e route mocks, test fixtures that assert known paths, and `services/agents-ui/src/lib/runtimeOrigins.ts` intentional constants from the static scan
- [ ] T030 [US3] Make the static scan fail on `'/api/v1'`, ``/api/v1``, client-side `X-User-Id`, `window.location.host`, `window.location.hostname`, and `window.location.protocol` when used for backend discovery
- [ ] T031 [US3] Document in `services/agents-ui/src/lib/runtimeOrigins.ts` tests that native bearer mode is blocked until backend work validates bearer identity through a trusted edge or `agents-api` JWT verification

## Phase 6: Backend Contract Handoff

**Goal**: Keep this client slice aligned with backend prerequisites without implementing backend work here.

- [ ] T032 [P] Add implementation notes to the eventual PR description linking native bearer release to `specs/014-backend-gaps-program/` G2, G3, G4, G5, and G6
- [ ] T033 [P] Confirm backend CORS tests cover `capacitor://localhost` and `http://localhost` for REST, chat stream, status stream, and WebSocket handshake before enabling native bearer mode in release config
- [ ] T034 [P] Confirm backend attach-token work exists before enabling terminal attach in native bearer mode

## Phase 7: Validation

- [ ] T035 Run `pnpm --filter @extratoast/agents-ui typecheck`
- [ ] T036 Run `pnpm --filter @extratoast/agents-ui lint`
- [ ] T037 Run `pnpm --filter @extratoast/agents-ui test`
- [ ] T038 Run the documentation verification command from [plan.md](./plan.md)

## Dependencies

- T007-T012 block all service migration tasks.
- T013-T019 can proceed after the URL builder exists.
- T020-T027 can proceed after `CredentialsModePolicy` exists; bearer mode stays release-blocked until backend identity validation is available.
- T028-T031 should land before or with the service migration so the guard proves the old literals are gone.
- T032-T034 are handoff checks tied to backend milestones, not implementation in this feature.
- T035-T038 run after the desired implementation tasks are complete.

## Parallel Example

```text
T008 [P] Add origin parser tests in services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts
T009 [P] Add URL builder tests in services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts
T010 [P] Add credential policy tests in services/agents-ui/src/lib/__tests__/runtimeOrigins.test.ts
```
