# Feature Specification: Observability for agents

**Feature Branch**: `008-observability`
**Created**: 2026-06-12
**Status**: Draft
**Input**: First-class observability for the agents stack: metrics, traces,
logs, dashboards, alerts, and uptime checks aligned with the agents repo.

## Overview

The agents stack needs to be observable as a first-class product after the
repo extraction and rename in spec 001. Operators must be able to answer
whether the API, gateway, runner pods, durable sessions, and public host are
healthy without stitching together ad hoc logs and Kubernetes state.

The agents services already follow the shared JVM telemetry shape in source:
`agents-api` and `agent-gateway` expose Spring Actuator Prometheus endpoints
under `/api/actuator`, use Micrometer, and send OpenTelemetry traces to Alloy
for Tempo. The cluster manifests in `personal-stack` already include an
`agents-api` ServiceMonitor, an `agents-api` Grafana dashboard, shared JVM
alerts that include `agents-api`, and Gatus checks for the agents API, UI, and
websocket-facing API replica. This feature turns that partial coverage into a
complete, verified observability contract across the agents repo and the
cluster observability manifests.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Service telemetry is complete and correlated (Priority: P1)

An operator investigating a request, session attach, or gateway failure can
move between metrics, traces, and logs for `agents-api` and each runtime
gateway without guessing service names or pod ownership.

**Why this priority**: Every dashboard, alert, and uptime check depends on
stable emitted telemetry. This is the foundation for the rest of the feature.

**Independent Test**: Deploy `agents-api` and at least one runner pod, scrape
their Actuator Prometheus endpoints, generate an API request and session attach,
then confirm Prometheus metrics, Tempo traces, and Loki logs share the expected
service identity and trace correlation fields.

**Acceptance Scenarios**:

1. **Given** `agents-api` is running, **When** Prometheus scrapes
   `/api/actuator/prometheus`, **Then** HTTP, JVM, process, logback, and custom
   metrics are available with `application="agents-api"`.
2. **Given** a request flows through `agents-api`, **When** traces are queried
   in Tempo, **Then** spans use the stable post-rename service name and logs
   include trace/span identifiers for the same request.
3. **Given** a runner pod is serving an in-pod gateway, **When** Prometheus
   discovers gateway telemetry, **Then** gateway metrics are queryable by
   service and pod/workspace ownership without relying on a hand-picked pod.

---

### User Story 2 - Agents operations are visible in dashboards and alerts (Priority: P1)

An operator can open Grafana and see the agents-specific health of sessions,
runner pods, PVC-backed storage, API/gateway traffic, logs, traces, and
resource pressure. Alert rules fire on actionable symptoms instead of only
generic cluster problems.

**Why this priority**: The renamed stack must be diagnosable in production, and
durable sessions add failure modes that generic JVM dashboards do not cover.

**Independent Test**: With normal traffic and at least one durable session,
open the agents dashboard set and verify panels populate for API/gateway
traffic, active sessions, restarts, replay bytes, attach failures, runner pod
state, and PVC usage. Evaluate Prometheus rules against synthetic or test
metrics for each agents-specific alert path.

**Acceptance Scenarios**:

1. **Given** the stack is receiving traffic, **When** the service dashboards are
   loaded, **Then** request rate, error rate, latency, JVM health, logs, and
   trace drill-down panels populate for `agents-api` and the gateway service.
2. **Given** durable sessions exist, **When** the agents dashboard is loaded,
   **Then** active sessions, restart counts, replay bytes, attach failures, and
   persisted/PVC usage are visible as first-class panels.
3. **Given** a gateway attach failure, repeated runner restart, replay failure,
   or PVC pressure condition, **When** alert rules are evaluated, **Then** the
   relevant agents-specific alert becomes pending/firing with labels that point
   to the affected service and runtime object.

---

### User Story 3 - Uptime checks cover the public and internal entry points (Priority: P2)

An operator can use the status system to confirm whether the public agents UI,
the API readiness endpoint, and the websocket-facing API path are reachable.

**Why this priority**: Uptime checks are the fastest way to separate public
availability failures from deeper service or runtime failures.

**Independent Test**: Reconcile the Gatus endpoints and confirm the agents UI,
internal API readiness endpoint, and websocket-facing API readiness endpoint
report healthy; then break one endpoint in a test environment and confirm the
check fails with the expected condition.

**Acceptance Scenarios**:

1. **Given** the cluster is healthy, **When** Gatus runs its agents checks,
   **Then** the public agents UI and internal API readiness endpoints report
   healthy status and response time within the configured threshold.
2. **Given** the websocket-facing API replica is unhealthy, **When** Gatus
   checks its readiness endpoint, **Then** only that check fails and the public
   UI/API checks remain independently visible.

---

### User Story 4 - Durable session SLO signals are stable (Priority: P2)

An operator can reason about the durability behavior from spec 002 using stable
signals rather than reading per-session logs.

**Why this priority**: Restart-with-history introduces new reliability
contracts: sessions must survive restarts, history replay must be bounded and
successful, and storage must not fill silently.

**Independent Test**: Start a durable session, restart the runner, reattach,
and verify the metrics change in predictable ways: active session count, restart
count, replay bytes, attach attempt/failure counters, and persisted storage
usage all update without high-cardinality labels.

**Acceptance Scenarios**:

1. **Given** a durable session is active, **When** it is listed in metrics,
   **Then** it contributes to active-session gauges by status/kind/run mode
   without exposing raw user, repository, or session identifiers as labels.
2. **Given** the runner restarts and history is replayed, **When** metrics are
   scraped, **Then** restart and replay counters increase and the replay byte
   count reflects the persisted history delivered to the attach path.
3. **Given** an attach fails, **When** the failure is recorded, **Then** the
   failure counter increments with an actionable bounded reason label.

### Edge Cases

- Runtime gateway pods are created and destroyed per workspace; scrape
  discovery must follow labels on active pods/services and avoid stale manual
  target lists.
- `agents-api` already uses `service.name=agents-api`, while the gateway source
  currently uses `agent-gateway`; the canonical gateway/runner service identity
  after spec 001 must be resolved before dashboards and alerts hard-code it.
- Health, readiness, and Prometheus scrape traffic can dominate traces; trace
  dashboards should filter routine actuator/health noise without hiding user
  requests and session operations.
- Zero active sessions is a valid state and must render as zero, not as broken
  telemetry or a firing alert.
- PVC usage may come from kubelet/kube-state metrics rather than application
  metrics; dashboards and alerts must distinguish missing PVC telemetry from
  healthy low usage.
- Durable-session metrics must not label by unbounded values such as raw user
  id, repository URL, transcript path, or full session id.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `agents-api` MUST preserve shared JVM observability: Micrometer
  Prometheus metrics at `/api/actuator/prometheus`, readiness/liveness health,
  JSON logs with service fields, and OpenTelemetry traces sent through Alloy to
  Tempo.
- **FR-002**: `agent-gateway` MUST provide equivalent gateway observability:
  Actuator Prometheus metrics, health, JSON logs, and OpenTelemetry traces for
  session spawn, attach, input, resize, replay, and stop operations.
- **FR-003**: Every emitted span and log record MUST use stable post-rename
  service identity and deployment environment attributes. `agents-api` is
  confirmed in source; the gateway/runner canonical `service.name` is
  [NEEDS CLARIFICATION: source uses `agent-gateway`, while the roadmap asks for
  `agents-*` service names after the rename].
- **FR-004**: Prometheus discovery MUST cover the static `agents-api` service
  and runtime gateway targets in runner pods/services, including dynamic
  discovery in `agents-system` using the existing runner labels such as
  `app.kubernetes.io/name=agent-runner` and `agent-runner/workspace-id`.
- **FR-005**: The agents repo MUST expose bounded durable-session metrics for:
  active sessions, session status, runner restart/reprovision count, history
  replay bytes, replay failures, attach attempts, attach failures, persisted
  transcript usage, and durable storage cap/usage.
- **FR-006**: Custom metric labels MUST be bounded and operationally useful:
  service, status, kind/run mode, reason, namespace, pod, and storage object are
  allowed where needed; raw user, repository, transcript path, and full session
  identifiers MUST NOT be metric labels.
- **FR-007**: Grafana dashboards MUST be updated or added for the agents stack:
  API and gateway golden signals, JVM/process health, logs, trace drill-down,
  active sessions, runner pod lifecycle, restart/reprovision activity, replay
  bytes, attach failures, and PVC/storage usage.
- **FR-008**: The existing `personal-stack` agents dashboard and shared
  dashboard references MUST be verified for current service names, titles,
  PromQL label selectors, and service shape; pre-rename labels or display names
  MUST be corrected where they are no longer meaningful.
- **FR-009**: Prometheus alert rules MUST include agents-specific symptoms in
  addition to shared platform JVM/pod/storage alerts: API/gateway scrape down,
  high API/gateway error rate, attach failure rate, replay failure rate, runner
  restart/reprovision spike, and durable-session/PVC storage pressure.
- **FR-010**: Gatus uptime checks MUST cover the public agents host, the
  internal API readiness endpoint, and the websocket-facing API readiness
  endpoint. Existing agents Gatus endpoints in `personal-stack` MUST be
  verified against the final post-rename hosts and services.
- **FR-011**: Alert and dashboard ownership MUST be decided and documented
  before implementation. Default assumption: `personal-stack` continues owning
  Grafana, PrometheusRule, ServiceMonitor/PodMonitor, and Gatus manifests while
  the agents repo owns emitted metric/trace/log contracts. Alternative:
  agents ships Flux-consumable manifests. [NEEDS CLARIFICATION: final ownership
  boundary is not specified].
- **FR-012**: Validation MUST include the smallest meaningful service checks in
  the agents repo plus manifest validation in `personal-stack` for any
  dashboard, rule, scrape, or Gatus changes.

### Key Entities *(include if feature involves data)*

- **Service telemetry identity**: Stable `service.name`, `application`,
  deployment environment, namespace, pod, and runtime labels used to correlate
  metrics, traces, and logs.
- **Runtime gateway target**: The in-pod gateway running inside a runner pod,
  discovered dynamically rather than through a static service list.
- **Durable-session signal**: Bounded metrics describing session state,
  restarts, replay volume, attach outcomes, and persisted storage pressure from
  spec 002.
- **Agents dashboard**: Grafana dashboard set for API/gateway traffic,
  durable-session behavior, runner pod health, storage, logs, and traces.
- **Agents alert rule**: PrometheusRule entries for actionable agents symptoms,
  with labels that identify the affected service/runtime object.
- **Agents uptime check**: Gatus endpoint for public and internal agents entry
  points.
- **Observability ownership boundary**: The division between emitted telemetry
  in the agents repo and cluster observability manifests in `personal-stack`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Prometheus has healthy scrape targets for `agents-api` and at
  least one runtime gateway, and queries return non-empty HTTP/JVM/process
  metrics for both during an active session.
- **SC-002**: Tempo contains traces for an API request and a gateway attach
  flow; Loki logs for the same flow include matching trace/span correlation
  fields.
- **SC-003**: Grafana shows non-empty panels for agents API/gateway traffic,
  errors, latency, JVM health, active sessions, restarts, replay bytes, attach
  failures, and PVC/storage usage during a test durable-session restart.
- **SC-004**: Agents-specific alert rules evaluate successfully and can be
  forced into pending/firing state in a test or synthetic-metric scenario for
  attach failure, replay failure, runner restart spike, and storage pressure.
- **SC-005**: Gatus reports healthy checks for the public agents host, internal
  API readiness endpoint, and websocket-facing API readiness endpoint in a
  healthy deployment.
- **SC-006**: Metric cardinality review finds no raw user, repository, transcript
  path, or full session identifiers in custom metric labels.
- **SC-007**: Any touched agents service checks pass, and any touched
  `personal-stack` observability manifests render/validate successfully.

## Assumptions

- Spec 001 completes the repo extraction and rename before this feature lands.
- Spec 002 provides durable-session mechanics and the source data needed for
  active session, restart, replay, attach, and persisted-storage signals.
- The current cluster observability stack remains Prometheus, Grafana, Loki,
  Tempo, Alloy, and Gatus.
- `personal-stack` remains the likely owner of cluster observability manifests;
  the agents repo owns the telemetry contract exposed by its services.
- Exact metric names, alert thresholds, and dashboard layout are planning
  details, but the required signal semantics are fixed by this spec.

## Non-Goals

- Implementing durable session persistence or restart-with-history mechanics
  from spec 002.
- Redesigning the agents UI from spec 003.
- Replacing Prometheus, Grafana, Loki, Tempo, Alloy, or Gatus.
- Defining formal long-term SLO policy, paging routes, or error-budget
  governance beyond the SLO-like signals required here.
- Adding observability for unrelated services outside the agents stack.

## Open Questions

- Should Grafana dashboards, Prometheus rules, scrape resources, and Gatus
  endpoints stay owned entirely by `personal-stack`, or should the agents repo
  ship Flux-consumable manifests that `personal-stack` applies?
- Should the gateway/runner telemetry identity remain `agent-gateway` and
  `agent-runner` to match spec 001 component names, or should it move to an
  `agents-*` service-name convention?
- Which exact alert thresholds define actionable attach failure rate, replay
  failure rate, restart spike, and storage pressure for the first release?
- Should durable storage usage be reported by application metrics, derived only
  from kubelet/kube-state PVC metrics, or shown through both sources?
