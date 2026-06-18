# Feature Specification: Build Release Native E2E

**Feature Branch**: `020-build-release-native-e2e`
**Created**: 2026-06-16
**Status**: Draft
**Input**: Spec cross-platform build and release policy for the Capacitor accounts + agents app, including native e2e runner policy.

## Decision

Release the Capacitor app through the existing repository release model: release-please creates the version tag, `VERSIONING.md` remains the rollback and consumption policy, and `.github/workflows/release.yml` publishes versioned artifacts from that tag.

The web artifact is the current `services/agents-ui` build and Docker image. The existing `publish-images` matrix in `.github/workflows/release.yml` already contains `services/agents-ui/Dockerfile` publishing `ghcr.io/extratoast/agents/agents-ui`; native release work must preserve that row and extend the release workflow instead of replacing it. If a later approved extraction creates a separate app web image, that image must be added as a new `publish-images` matrix entry in the same release workflow.

Native releases are store-delivered:

- Android publishes signed AABs to Google Play.
- iOS archives signed IPAs and uploads them to TestFlight/App Store Connect.
- Over-the-air update systems are not allowed by default. **NO OTA** until a separate approved decision records the provider, trust model, rollback semantics, and store-policy review.

Native e2e uses Maestro. Android smoke is PR-gated on Ubuntu through the app CI jobs and `Pipeline Complete`. iOS smoke/e2e is scheduled, manual, and release-gated only until macOS runner capacity is confirmed. This checkout has no `.github/workflows/*.yml` job using `runs-on: macos-*` or a self-hosted macOS label, so macOS runner capacity is currently unconfirmed and must be treated as unavailable for required PR gates.

Platform floors start at Capacitor 7 minimums: Android `minSdkVersion` API 23 and iOS deployment target 15.5. Plugin audit may raise these floors, but must not lower them below Capacitor 7 requirements.

## User Scenarios & Testing

### User Story 1 - Publish web and native artifacts from one release tag (Priority: P1)

A maintainer merges the release-please PR and receives the web Docker image, Android Play artifact, and iOS TestFlight/App Store artifact for the same version tag.

**Why this priority**: VERSIONING.md makes released tags the deployable unit; native and web artifacts must not drift from separate manual versioning.

**Independent Test**: Run or inspect a release workflow for a release-please tag and verify that every artifact uses `needs.release-please.outputs.tag_name || github.sha` consistently, with store uploads only from release-created or manual release events.

**Acceptance Scenarios**:

1. **Given** release-please creates tag `vX.Y.Z`, **When** `.github/workflows/release.yml` runs, **Then** the web Docker image is pushed with `vX.Y.Z` and the native builds are created from the same ref.
2. **Given** the app package remains `services/agents-ui`, **When** the web image is published, **Then** the existing `agents-ui` `publish-images` matrix row remains the web image source.
3. **Given** a later approved extraction creates a distinct app web image, **When** release workflow changes are made, **Then** the new web image is added to `publish-images` instead of bypassing the existing release workflow.

---

### User Story 2 - Sign and publish Android safely (Priority: P1)

A maintainer can publish a signed Android App Bundle to Google Play without committing keystores or service account JSON.

**Why this priority**: Store signing secrets are production credentials and must be isolated from source, logs, and PR contexts.

**Independent Test**: On a release event or protected manual dispatch, build a release AAB, sign it from GitHub environment secrets, upload it to an internal Play track, and verify no signing material appears in logs or repository files.

**Acceptance Scenarios**:

1. **Given** the release workflow runs on a release tag, **When** the Android job starts, **Then** it decodes the keystore from a protected GitHub environment secret and signs an AAB for Play.
2. **Given** the Google Play upload runs, **When** credentials are loaded, **Then** they come from protected GitHub environment secrets and are never committed to the repo.
3. **Given** a PR from an untrusted context, **When** Android CI runs, **Then** it uses debug/unsigned smoke artifacts only and cannot read Play or signing secrets.

---

### User Story 3 - Upload iOS builds without making macOS PR-required (Priority: P1)

A maintainer can upload iOS builds to TestFlight/App Store Connect, but normal PR merges do not wait on unavailable macOS capacity.

**Why this priority**: iOS signing requires macOS, certificates, and provisioning profiles; this repository currently has no macOS runner usage to prove capacity for every PR.

**Independent Test**: Inspect workflows and verify PR-required jobs do not require a macOS runner until a documented runner pool exists; run iOS archive/upload only on schedule, manual dispatch, or release-gated events.

**Acceptance Scenarios**:

1. **Given** the current workflows only use Ubuntu runners, **When** native e2e policy is applied, **Then** iOS e2e is not a normal PR-required gate.
2. **Given** a protected manual or release event has iOS secrets available, **When** the iOS job runs on macOS, **Then** it signs with the configured Apple team/provisioning profile and uploads through App Store Connect API credentials.
3. **Given** macOS runner capacity is later confirmed, **When** policy is revisited, **Then** iOS PR gating may be promoted only after duration, flake, and cost data are recorded.

---

### User Story 4 - Gate native e2e pragmatically (Priority: P2)

A maintainer receives native smoke coverage on PRs without slowing every change on full mobile store-grade workflows.

**Why this priority**: Existing gates already cover JVM, UI, OpenAPI, and Docker. Native CI must add confidence without making the single `Pipeline Complete` check unreliable.

**Independent Test**: On a PR, confirm `app-android-smoke` runs an Android emulator smoke with Maestro and is included in `pipeline-complete.needs`; confirm iOS legs are skipped or absent from PR-required paths.

**Acceptance Scenarios**:

1. **Given** a PR changes app code, **When** CI runs, **Then** Android smoke runs with Maestro and is required through `Pipeline Complete`.
2. **Given** scheduled or manual native e2e runs, **When** the native e2e workflow runs, **Then** it may execute broader Android and iOS Maestro suites outside the normal PR-required path.
3. **Given** the release workflow prepares store artifacts, **When** native smoke fails on the release candidate, **Then** native store upload is blocked.

## Edge Cases

- If Android emulator startup is flaky on GitHub-hosted Ubuntu, the Android PR gate must be reduced to the smallest deterministic Maestro smoke before demoting it from `Pipeline Complete`.
- If iOS runner capacity appears in a different workflow or a reusable workflow, the policy must be updated with the concrete runner label and capacity evidence before making iOS PR-required.
- If plugin audit raises platform floors above Android API 23 or iOS 15.5, release notes and store metadata must call out the raised minimums before publishing.
- If release-please does not create a tag, native store upload must not publish a manually invented version.
- If a Play or App Store rollback cannot restore an older binary for already-updated users, the rollback plan must use rollout pause plus a hotfix release rather than claiming full client downgrade.

## Requirements

### Functional Requirements

- **FR-001**: Native and web release artifacts MUST be built from the release-please tag produced by `.github/workflows/release.yml`, using `release-please-config.json` and `.release-please-manifest.json` as release state.
- **FR-002**: Release versioning and rollback documentation MUST stay aligned with `VERSIONING.md`: released tags are immutable, deployments consume pinned tags, and web rollback is a git revert of the consuming tag bump.
- **FR-003**: `.github/workflows/release.yml` MUST preserve the existing `publish-images` matrix row for `services/agents-ui/Dockerfile` publishing `ghcr.io/extratoast/agents/agents-ui`.
- **FR-004**: Any future separate app web Docker image MUST be added to the existing `publish-images` matrix rather than published by an unrelated workflow.
- **FR-005**: Android release MUST produce a signed AAB for Google Play from protected release secrets and MUST NOT expose signing secrets to PRs.
- **FR-006**: iOS release MUST produce a signed archive/IPA for TestFlight/App Store Connect from protected release secrets and MUST run only where a macOS runner is available.
- **FR-007**: Signing material MUST live in GitHub environment or repository secrets, not in source-controlled files, generated native projects, logs, release notes, or artifacts.
- **FR-008**: Android signing secrets MUST be named and scoped as: `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_KEYSTORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, `ANDROID_RELEASE_KEY_PASSWORD`, and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in the protected `android-play` GitHub Environment.
- **FR-009**: iOS signing and App Store Connect secrets MUST be named and scoped as: `APPLE_TEAM_ID`, `IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64`, `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_APPSTORE_BASE64`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, and `APP_STORE_CONNECT_API_PRIVATE_KEY` in the protected `ios-app-store` GitHub Environment.
- **FR-010**: Android PR smoke MUST use Maestro and MUST be required through `app-android-smoke` and `Pipeline Complete` once the scaffold jobs from `specs/016-scaffold-ci-workspace/spec.md` exist.
- **FR-011**: iOS Maestro smoke/e2e MUST be scheduled, manual, and release-gated only until macOS runner capacity is documented; it MUST NOT be a normal PR-required gate while this repo has no macOS runner evidence.
- **FR-012**: If `app-native-e2e` remains in `pipeline-complete.needs`, its PR path MUST not require iOS/macOS capacity; iOS legs must be event-gated or represented by a successful policy check explaining the deferral.
- **FR-013**: Store upload jobs MUST be protected by release-created, protected manual dispatch, or equivalent release-gated conditions; PRs MUST build only non-secret debug or simulator artifacts.
- **FR-014**: OTA update systems MUST NOT be enabled until a later approved decision explicitly adopts OTA and defines security, review, rollback, and observability requirements.
- **FR-015**: Android platform floor MUST start at API 23 and iOS deployment target MUST start at 15.5, subject only to a plugin audit that raises the minimums.
- **FR-016**: Native release rollback MUST document platform-realistic behavior: Play staged rollout halt or prior release promotion where available; App Store phased release pause plus hotfix when downgrade is not possible.

### Key Entities

- **Release tag**: The `vX.Y.Z` tag created by release-please and used for web Docker, Android, and iOS release artifacts.
- **Web image**: `ghcr.io/extratoast/agents/agents-ui` built from `services/agents-ui/Dockerfile` through the `publish-images` matrix.
- **Android release artifact**: Signed AAB uploaded to Google Play from protected Android secrets.
- **iOS release artifact**: Signed archive/IPA uploaded to TestFlight/App Store Connect from protected Apple secrets.
- **Maestro smoke suite**: Minimal native e2e suite proving launch, login shell availability where credentials allow, and one critical app navigation path.
- **Runner policy**: Android smoke is PR-gated; iOS native e2e is scheduled/manual/release-gated until macOS capacity is confirmed.

## Dependencies

- `specs/013-native-target-adr/spec.md`: Capacitor 7 and in-place `services/agents-ui` reuse decision.
- `specs/016-scaffold-ci-workspace/spec.md`: app CI job names and `Pipeline Complete` integration.
- `.github/workflows/ci.yml`: existing required CI aggregator and Ubuntu-only runner evidence.
- `.github/workflows/release.yml`: existing release-please and `publish-images` workflow.
- `VERSIONING.md`: released tag, consumption, and rollback convention.

## Success Criteria

- **SC-001**: Release planning identifies one tag as the source for web Docker, Android Play, and iOS TestFlight/App Store artifacts.
- **SC-002**: Android signing and Play upload secret names and locations are documented and never required for PR checks.
- **SC-003**: iOS signing, provisioning, and App Store Connect secret names and locations are documented, with iOS PR gating deferred because macOS runners are not present in current workflows.
- **SC-004**: Maestro is selected for native e2e, with Android smoke required on PRs and iOS limited to schedule/manual/release until runner capacity changes.
- **SC-005**: OTA is explicitly disabled by default.
- **SC-006**: Android API 23 and iOS 15.5 are recorded as the minimum initial floors, with plugin audit allowed only to raise them.

## Out of Scope

- Implementing workflow YAML, store upload actions, or signing scripts in this task.
- Choosing an OTA provider.
- Creating Play Console or App Store Connect applications.
- Promoting iOS to required PR gating before macOS runner capacity exists.
