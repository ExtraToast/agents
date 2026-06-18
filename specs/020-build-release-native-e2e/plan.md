# Implementation Plan: Build Release Native E2E

**Branch**: `020-build-release-native-e2e` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-build-release-native-e2e/spec.md`

## Summary

Extend the existing release model to publish the Capacitor app across web, Android, and iOS from release-please tags. Keep the current `agents-ui` Docker image in the `publish-images` matrix, add store release lanes with protected signing secrets, select Maestro for native e2e, require Android smoke on PRs, and defer iOS PR gating until macOS runner capacity is confirmed.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5.x, Node 22, pnpm 9.15.4, Capacitor 7
**Primary Dependencies**: Existing Vue/Vite build in `services/agents-ui`, generated Capacitor Android/iOS projects, Maestro for native e2e
**Storage**: N/A for app release; signing material lives only in GitHub protected environments/secrets
**Testing**: Existing `workflow-lint`, `jvm-check`, `ui-check`, `openapi-contract`, `docker-build`; app gates from spec 016; Maestro Android smoke on PR; Maestro iOS on schedule/manual/release only
**Target Platform**: Web Docker image, Android Google Play AAB, iOS TestFlight/App Store Connect IPA/archive
**Project Type**: pnpm workspace app plus generated native shells and GitHub Actions release automation
**Performance Goals**: Android PR smoke stays minimal enough for required CI; full native e2e runs outside normal PR path unless stability data proves otherwise
**Constraints**: Existing workflows currently use Ubuntu only; no macOS runner evidence exists in `.github/workflows/*.yml`; no OTA without later approval; platform floors start at Android API 23 and iOS 15.5
**Scale/Scope**: One app package, one existing web Docker image row, protected Android and iOS release lanes, one native e2e runner policy

## Constitution Check

- [x] No attribution is introduced in files, comments, commit text, or PR text
- [x] Existing web release behavior is preserved by extending `release.yml`
- [x] Secrets are kept out of source and generated artifacts
- [x] Small stacked PR boundary is clear: this spec defines policy, later tasks implement workflows/scripts
- [x] Verification commands and policy checks are identified for release and CI changes

## Project Structure

### Documentation

```text
specs/020-build-release-native-e2e/
|-- plan.md
|-- spec.md
`-- tasks.md
```

### Existing Files Read For This Plan

```text
.github/workflows/ci.yml
.github/workflows/release.yml
VERSIONING.md
services/agents-ui/package.json
specs/013-native-target-adr/spec.md
specs/016-scaffold-ci-workspace/spec.md
```

### Implementation Ownership

```text
.github/workflows/release.yml
.github/workflows/ci.yml
services/agents-ui/package.json
services/agents-ui/android/
services/agents-ui/ios/
```

This spec does not edit those implementation files. It defines the future build/release and native e2e ownership. Later implementation must respect the CI workflow ownership from `specs/016-scaffold-ci-workspace/spec.md`.

## Phase 0: Release Baseline

1. Confirm `VERSIONING.md` still defines release-please tags as the deployable unit and rollback as git revert of consuming tag bumps.
2. Confirm `.github/workflows/release.yml` still contains `release-please` and `publish-images`.
3. Confirm the `publish-images` matrix still includes:
   - `image: agents-ui`
   - `repository: ghcr.io/extratoast/agents/agents-ui`
   - `dockerfile: services/agents-ui/Dockerfile`
4. Confirm `.github/workflows/ci.yml` still aggregates required jobs through `pipeline-complete`.

**Gate**: Do not add native release lanes until the release tag source and web image row are preserved.

## Phase 1: Web Release Integration

1. Keep `services/agents-ui` as the web build source while the Capacitor app is in-place.
2. Keep `services/agents-ui/Dockerfile` in `publish-images`.
3. Ensure Docker build args continue to receive the release tag or SHA through the existing `GIT_SHA` pattern.
4. If a separate app package is later approved, add its web Docker image as an additional `publish-images` matrix entry instead of creating a second release workflow.

**Gate**: A release tag publishes the web image with the same immutable tag used by native release artifacts.

## Phase 2: Android Release Lane

1. Build a release AAB from the generated Android project under the selected app package.
2. Use the protected `android-play` GitHub Environment.
3. Read only these secrets from that environment:
   - `ANDROID_RELEASE_KEYSTORE_BASE64`
   - `ANDROID_RELEASE_KEYSTORE_PASSWORD`
   - `ANDROID_RELEASE_KEY_ALIAS`
   - `ANDROID_RELEASE_KEY_PASSWORD`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
4. Decode signing material only into runner-temporary files and delete them before job completion where practical.
5. Upload to Google Play internal testing first; promotion beyond internal testing requires explicit release approval.
6. Do not expose these secrets to PR jobs or fork contexts.

**Gate**: Android release artifacts are signed only on protected release/manual events and never in normal PR checks.

## Phase 3: iOS Release Lane

1. Build/archive from the generated iOS project under the selected app package.
2. Use macOS only for iOS archive/upload jobs.
3. Use the protected `ios-app-store` GitHub Environment.
4. Read only these secrets from that environment:
   - `APPLE_TEAM_ID`
   - `IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64`
   - `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
   - `IOS_PROVISIONING_PROFILE_APPSTORE_BASE64`
   - `APP_STORE_CONNECT_API_KEY_ID`
   - `APP_STORE_CONNECT_API_ISSUER_ID`
   - `APP_STORE_CONNECT_API_PRIVATE_KEY`
5. Upload release candidates to TestFlight before App Store release.
6. Keep iOS out of normal PR-required gates until a macOS runner label, capacity, runtime, and cost policy are documented.

**Gate**: iOS can block release promotion, but it cannot block every PR while macOS capacity is unconfirmed.

## Phase 4: Native E2E Runner Policy

1. Select Maestro as the native e2e runner.
2. Add the smallest useful Android smoke suite to PR CI:
   - install debug APK on a GitHub-hosted Ubuntu emulator
   - launch the app
   - verify the shell loads
   - exercise one stable navigation path
3. Run Android smoke through `app-android-smoke` and `Pipeline Complete` after spec 016 job stubs exist.
4. Keep broader Android Maestro suites scheduled/manual until duration and flake data supports promotion.
5. Run iOS Maestro suites on schedule, manual dispatch, and release-gated events only.
6. If `app-native-e2e` is included in `pipeline-complete.needs`, make its PR path Android-only or a successful policy check that does not require macOS.

**Gate**: Required PR CI must not depend on iOS/macOS before runner capacity is real.

## Phase 5: OTA And Platform Floors

1. Do not add Capacitor live-update, CodePush-style, or custom OTA update providers.
2. If OTA is requested later, require a new decision covering:
   - provider and signing model
   - store policy review
   - release provenance
   - rollback behavior
   - observability and kill switch
3. Set Android `minSdkVersion` to API 23 unless plugin audit raises it.
4. Set iOS deployment target to 15.5 unless plugin audit raises it.
5. Record any raised floor in release notes and store metadata.

**Gate**: No native release can ship with OTA enabled or with platform floors lower than Capacitor 7 minimums.

## Phase 6: Rollback Policy

1. Web rollback follows `VERSIONING.md`: revert the consuming deployment tag bump.
2. Android rollback uses Google Play staged rollout controls:
   - halt rollout for a bad release
   - promote a previous release where Play allows it
   - otherwise ship a hotfix with a higher `versionCode`
3. iOS rollback uses App Store operational limits:
   - pause phased release where available
   - remove from sale only when appropriate
   - ship a hotfix because installed users generally cannot be downgraded
4. Release notes must not claim full mobile binary downgrade semantics.

**Gate**: Rollback runbooks distinguish web deploy rollback from mobile store recovery.

## Risks And Mitigations

- **Secret exposure**: Use protected GitHub Environments, temp files, masking, and no PR secret access.
- **macOS capacity**: Keep iOS scheduled/manual/release-gated until a concrete runner pool exists.
- **Android emulator flake**: Keep the PR Maestro suite minimal and demote only with evidence plus an alternate required native build gate.
- **Version drift**: Build all artifacts from release-please tag output.
- **OTA pressure**: Keep OTA disabled unless a later decision accepts the additional security and store-policy surface.
- **Store rollback mismatch**: Document mobile rollback as rollout pause/hotfix, not a guaranteed downgrade.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| N/A | N/A | N/A |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Evidence complete for this spec
- [ ] Phase 1: Web release integration
- [ ] Phase 2: Android release lane
- [ ] Phase 3: iOS release lane
- [ ] Phase 4: Native e2e runner policy
- [ ] Phase 5: OTA and platform floors
- [ ] Phase 6: Rollback policy

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved

## Documentation-Only Verification

```bash
test -f specs/020-build-release-native-e2e/spec.md \
  && test -f specs/020-build-release-native-e2e/plan.md \
  && test -f specs/020-build-release-native-e2e/tasks.md \
  && grep -qi 'Maestro' specs/020-build-release-native-e2e/spec.md \
  && grep -qi 'NO OTA' specs/020-build-release-native-e2e/spec.md \
  && grep -qi 'ANDROID_RELEASE_KEYSTORE_BASE64' specs/020-build-release-native-e2e/spec.md \
  && grep -qi 'APP_STORE_CONNECT_API_KEY_ID' specs/020-build-release-native-e2e/spec.md
```
