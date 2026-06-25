import type { components } from '@/api/generated'
import type { FieldError as ApiFieldError, ProblemDetail as ApiProblemDetail } from '@/lib/vueWebCommons'

export type WorkspaceStatus = 'PENDING' | 'STARTING' | 'READY' | 'IDLE' | 'FAILED' | 'DESTROYED'

/**
 * Workspace flavour. The shape PR E introduced so the redesigned UI
 * can distinguish a real cloned repo from a scratch sandbox or a
 * chat-only session.
 *
 * - `REPO_BACKED`: Pod boots, clones `repoUrl` / `branch` through the
 *   GitHub App installation. The default.
 * - `SCRATCH`: Pod boots without a clone. The agent has a shell + the
 *   CLIs but no working tree.
 * - `CHAT`: no Pod at all. The "workspace" is purely a placeholder so
 *   sessions can reference it; chat traffic flows through
 *   `chat_sessions` separately.
 */
export type WorkspaceKind = 'REPO_BACKED' | 'SCRATCH' | 'CHAT'

export type AgentSetupReference = components['schemas']['AgentSetupReferenceResponse']

export type WorkspaceRunnerSetupOperation = 'IDLE' | 'RESTARTING' | 'FAILED'

export interface WorkspaceRunnerSetup {
  current: AgentSetupReference
  pending?: AgentSetupReference | null
  generation: number
  operation: WorkspaceRunnerSetupOperation
  operationStartedAt?: string | null
  operationUpdatedAt?: string | null
}

export interface WorkspaceRunnerImage {
  /** Operator-readable agent-runner release version (e.g. "0.12.0"), or null when no running runner. */
  version: string | null
  /** True when a newer agent-runner release is available than the one the runner is on. */
  upgradeAvailable: boolean
}

export interface Workspace {
  id: string
  name: string
  repoUrl: string | null
  branch: string | null
  podName: string | null
  gatewayEndpoint: string | null
  status: WorkspaceStatus
  kind: WorkspaceKind
  projectId: string | null
  repositoryId: string | null
  /**
   * @deprecated Legacy GithubLink id. Surfaces during the M:N
   * migration window so existing rows keep rendering; net-new
   * callers should use `repositoryId`.
   */
  githubLinkId: string | null
  runnerSetup?: WorkspaceRunnerSetup
  runnerImage?: WorkspaceRunnerImage | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceRepositoryVerification {
  defaultBranchProtected?: boolean | null
  checkedAt?: string | null
  messages: string[]
}

export interface WorkspaceRepository {
  id: string
  name: string
  repoUrl: string
  defaultBranch: string
  createdAt: string
  updatedAt: string
  verification?: WorkspaceRepositoryVerification | null
  isPrimary: boolean
  attachedAt: string
}

export interface WorkspaceDetailWorkspace extends Workspace {
  repositories?: WorkspaceRepository[]
}

export type AgentKind = 'CLAUDE' | 'CODEX' | 'SHELL'

export type AgentSessionStatus = 'STARTING' | 'RUNNING' | 'STOPPED' | 'FAILED'

export interface AgentSession {
  id: string
  workspaceId: string
  kind: AgentKind
  gatewayAgentId: string | null
  epoch?: number
  generation?: number
  gatewayBoundAt?: string | null
  status: AgentSessionStatus
  idle?: boolean
  currentSetup?: AgentSetupReference
  pendingSetup?: AgentSetupReference | null
  createdAt: string
  updatedAt: string
}

export type AgentSetupCatalogEntry = components['schemas']['AgentSetupCatalogEntryResponse']

export type AgentSetupBinding = components['schemas']['AgentSetupBindingResponse']
export type AgentSetupValidationIssue = components['schemas']['AgentSetupValidationIssueResponse']
export type AgentSetupValidation = components['schemas']['AgentSetupValidationResponse']

export type SetupTargetOption = components['schemas']['SetupTargetOptionResponse']
export type SetupTargetOptions = components['schemas']['SetupTargetOptionsResponse']

export type AgentSetupDiffChange = components['schemas']['AgentSetupDiffChangeResponse']
export type AgentSetupDiff = components['schemas']['AgentSetupDiffResponse']
export type SetupPreview = components['schemas']['SetupPreviewResponse']
export type SessionSetupState = components['schemas']['SessionSetupStateResponse']
export type FailedSessionSetup = components['schemas']['FailedSessionSetupResponse']

export type SetupTransitionStatus = 'REQUESTED' | 'STARTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type SetupTransition = components['schemas']['SetupTransitionResponse']
export type SetupTransitionHistory = components['schemas']['SetupTransitionHistoryResponse']

// Re-export the shared-commons problem types: ApiError (the consumer of
// these) is typed against vue-web-commons' ProblemDetail, whose optional
// fields are `string` rather than the generated `string | null`, so basing
// our types on the commons shape keeps them assignable to ApiError.
export type FieldError = ApiFieldError
export type ProblemDetail = ApiProblemDetail

export interface AgentSetupValidationProblem extends ProblemDetail {
  type: 'https://jorisjonkers.dev/errors/agent-setup-validation'
  status: 422
  // A validation problem always carries a human-readable detail.
  detail: string
  errors: FieldError[]
}

export type TurnRole = 'USER' | 'AGENT' | 'SYSTEM'

export interface Turn {
  id: string
  sessionId: string
  role: TurnRole
  body: string
  createdAt: string
}

export interface StagedInput {
  path: string
  bytes: number
  name: string
}

export interface RestartSessionResponse {
  sessionId: string
  epoch: number
  generation: number
  status: AgentSessionStatus
  currentSetup?: AgentSetupReference
  pendingSetup?: AgentSetupReference | null
}

export type WorkspaceConnectResponse = components['schemas']['WorkspaceConnectResponse']

/**
 * Tracks the readiness of the workspace runner after a connect call.
 * `booting` means the runner is still starting up and new sessions would
 * get a pre-bind 503; spawn controls should be disabled.
 */
export type RunnerReadiness = 'unknown' | 'booting' | 'ready' | 'failed'

export interface WorkspaceDetail {
  workspace: WorkspaceDetailWorkspace
  sessions: AgentSession[]
}
