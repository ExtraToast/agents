# Tasks: Build Release Native E2E

**Input**: Build/release/native e2e specification from `/specs/020-build-release-native-e2e/spec.md`
**Prerequisites**: `specs/013-native-target-adr/spec.md`, `specs/016-scaffold-ci-workspace/spec.md`, current `.github/workflows/ci.yml`, current `.github/workflows/release.yml`, `VERSIONING.md`

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel because it touches different files or only reads source context
- Tasks describe future implementation work. This worker task creates only the Spec Kit files in this directory.

## Phase 1: Baseline Verification

- [ ] T001 Verify `.github/workflows/release.yml` still has `release-please` and `publish-images`
- [ ] T002 Verify the `publish-images` matrix still includes `services/agents-ui/Dockerfile` publishing `ghcr.io/extratoast/agents/agents-ui`
- [ ] T003 Verify `VERSIONING.md` still defines release-please tags, pinned deployment tags, and git-revert web rollback
- [ ] T004 Verify `.github/workflows/ci.yml` still uses `pipeline-complete` as the required aggregate gate
- [ ] T005 Verify current workflows contain no `runs-on: macos-*` or self-hosted macOS runner label before treating iOS as PR-required

## Phase 2: Web Release Path

- [ ] T006 Preserve the existing `agents-ui` web image row in `.github/workflows/release.yml`
- [ ] T007 Ensure the web Docker image uses the release tag or SHA consistently through the existing release workflow tag expression
- [ ] T008 [P] Document any future separate app web image as an added `publish-images` matrix row rather than a separate release workflow
- [ ] T009 Verify the web image can still be pulled as `ghcr.io/extratoast/agents/agents-ui:<tag>` after release

## Phase 3: Android Play Release Path

- [ ] T010 Configure the protected GitHub Environment `android-play`
- [ ] T011 Add `ANDROID_RELEASE_KEYSTORE_BASE64` to the `android-play` environment
- [ ] T012 Add `ANDROID_RELEASE_KEYSTORE_PASSWORD` to the `android-play` environment
- [ ] T013 Add `ANDROID_RELEASE_KEY_ALIAS` to the `android-play` environment
- [ ] T014 Add `ANDROID_RELEASE_KEY_PASSWORD` to the `android-play` environment
- [ ] T015 Add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` to the `android-play` environment
- [ ] T016 Build the Android release AAB from the generated Capacitor Android project under the selected app package
- [ ] T017 Sign the Android AAB using only runner-temporary decoded keystore material
- [ ] T018 Upload the signed AAB to the Google Play internal testing track on protected release/manual events
- [ ] T019 Verify Android PR jobs build only debug or unsigned smoke artifacts and cannot read Play/signing secrets

## Phase 4: iOS TestFlight/App Store Path

- [ ] T020 Configure the protected GitHub Environment `ios-app-store`
- [ ] T021 Add `APPLE_TEAM_ID` to the `ios-app-store` environment
- [ ] T022 Add `IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64` to the `ios-app-store` environment
- [ ] T023 Add `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` to the `ios-app-store` environment
- [ ] T024 Add `IOS_PROVISIONING_PROFILE_APPSTORE_BASE64` to the `ios-app-store` environment
- [ ] T025 Add `APP_STORE_CONNECT_API_KEY_ID` to the `ios-app-store` environment
- [ ] T026 Add `APP_STORE_CONNECT_API_ISSUER_ID` to the `ios-app-store` environment
- [ ] T027 Add `APP_STORE_CONNECT_API_PRIVATE_KEY` to the `ios-app-store` environment
- [ ] T028 Add an iOS archive/export path that runs only on macOS release, manual, or scheduled events
- [ ] T029 Upload signed iOS builds to TestFlight through App Store Connect API credentials
- [ ] T030 Keep iOS jobs out of normal PR-required gating until macOS runner capacity is documented

## Phase 5: Maestro Native E2E Policy

- [ ] T031 Select Maestro as the only native e2e runner for initial Android and iOS smoke coverage
- [ ] T032 Add a minimal Android Maestro smoke flow for app launch, shell readiness, and one stable navigation path
- [ ] T033 Run Android Maestro smoke through `app-android-smoke` on PRs and include it in `pipeline-complete.needs`
- [ ] T034 Keep broader Android Maestro suites scheduled/manual until runtime and flake data supports promotion
- [ ] T035 Add iOS Maestro smoke flows for scheduled/manual/release-gated runs only
- [ ] T036 If `app-native-e2e` remains in `pipeline-complete.needs`, ensure its PR path does not require macOS and exits successfully with the documented iOS deferral
- [ ] T037 Record Android emulator duration and flake rate before expanding required PR coverage
- [ ] T038 Record macOS runner label, capacity, average runtime, and cost before proposing iOS PR-required gating

## Phase 6: OTA And Platform Floors

- [ ] T039 Verify no OTA provider or live-update plugin is added to the Capacitor app
- [ ] T040 Require a separate approved decision before enabling OTA
- [ ] T041 Set Android `minSdkVersion` to API 23 unless plugin audit raises it
- [ ] T042 Set iOS deployment target to 15.5 unless plugin audit raises it
- [ ] T043 [P] Audit Capacitor plugins for platform floor requirements before the first store release
- [ ] T044 Document any raised platform floor in release notes and store metadata

## Phase 7: Rollback And Release Verification

- [ ] T045 Document web rollback as git revert of the consuming deployment tag bump per `VERSIONING.md`
- [ ] T046 Document Android rollback as staged rollout halt, previous release promotion where Play allows it, or hotfix with higher `versionCode`
- [ ] T047 Document iOS rollback as phased release pause or hotfix because installed users generally cannot be downgraded
- [ ] T048 Verify release notes do not claim OTA or guaranteed mobile binary downgrade semantics
- [ ] T049 Verify release workflow builds web Docker, Android, and iOS artifacts from the same release-please tag
- [ ] T050 Verify no signing files, provisioning profiles, App Store Connect keys, or service account JSON files are committed

## Dependencies

- T001 through T005 precede workflow implementation because release and runner policy depend on current workflow shape.
- T006 through T009 precede native release lanes because the web image must stay the baseline release artifact.
- T010 through T019 require the generated Android project from the Capacitor scaffold.
- T020 through T030 require a macOS runner for archive/upload execution, but not for normal PR gating.
- T031 through T038 depend on the app CI job names from `specs/016-scaffold-ci-workspace/spec.md`.
- T039 through T044 precede first store submission.
- T045 through T050 run before the first production mobile release.

## Downstream Handoff

- Scaffold work owns the generated Android/iOS project placement and app CI job stubs.
- Test strategy work owns detailed Vitest, Playwright, and Maestro fixture design, but must follow this runner policy.
- Release workflow implementation owns `.github/workflows/release.yml` edits and protected environment wiring.
- Store operations own Play Console and App Store Connect application setup outside the repo.

## Parallel Example

```text
T010 [P] Configure android-play environment
T020 [P] Configure ios-app-store environment
T032 [P] Add Android Maestro smoke flow
T043 [P] Audit Capacitor plugin platform floors
```

```text
T045 [P] Document web rollback
T046 [P] Document Android rollback
T047 [P] Document iOS rollback
T050 [P] Verify no signing files are committed
```
