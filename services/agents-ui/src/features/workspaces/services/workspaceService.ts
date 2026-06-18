import type {
  AgentKind,
  AgentSetupReference,
  AgentSetupValidationProblem,
  RestartSessionResponse,
  SessionSetupState,
  SetupPreview,
  SetupTargetOptions,
  SetupTransitionHistory,
  StagedInput,
  Turn,
  Workspace,
  WorkspaceConnectResponse,
  WorkspaceDetail,
} from '../types'
import type { components } from '@/api/generated'
import { ApiError, useApiWithAuth } from '@/lib/vueWebCommons'

function getApi(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

// A freshly-provisioned runner's gateway needs a JVM cold start before
// it is Ready; agents-api answers start-session with a 503 carrying
// retryAfterSeconds until then. Poll through that window rather than
// surfacing the transient 503 to the user.
const SESSION_START_BUDGET_MS = 180_000
const DEFAULT_RETRY_AFTER_S = 5
const AGENT_SETUP_VALIDATION_TYPE = 'https://jorisjonkers.dev/errors/agent-setup-validation'

// RunnerUnavailableReason values emitted by the backend for transient boot-time
// 503s. Retrying these is safe because the runner is still warming up.
// Reasons absent from this set (e.g. 'provision_failed', 'workspace_not_found')
// signal deterministic failures — surfacing them immediately avoids burning
// SESSION_START_BUDGET_MS and minting duplicate sessions.
const RETRYABLE_RUNNER_STATUSES = new Set([
  'boot_lease_held',
  'setup_operation_in_progress',
  'not_ready_after_provision',
])

function isRetryable503(err: ApiError): boolean {
  const runnerStatus = err.problem.runnerStatus
  return runnerStatus == null || RETRYABLE_RUNNER_STATUSES.has(runnerStatus)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return getApi().get<Workspace[]>('/workspaces')
}

export async function getWorkspace(id: string): Promise<WorkspaceDetail> {
  return getApi().get<WorkspaceDetail>(`/workspaces/${id}`)
}

/**
 * Signal to the backend that the user has opened this workspace so the
 * runner pod is provisioned/woken up. Returns immediately; the `state`
 * field indicates whether the runner is already `READY` or still booting.
 */
export async function connectWorkspace(id: string): Promise<WorkspaceConnectResponse> {
  return getApi().post<WorkspaceConnectResponse>(`/workspaces/${id}/connect`, {})
}

export async function getSessionSetup(workspaceId: string, sessionId: string): Promise<SessionSetupState> {
  return getApi().get<SessionSetupState>(`/workspaces/${workspaceId}/sessions/${sessionId}/setup`)
}

export async function listSetupOptions(workspaceId: string, sessionId: string): Promise<SetupTargetOptions> {
  return getApi().get<SetupTargetOptions>(`/workspaces/${workspaceId}/sessions/${sessionId}/setup-options`)
}

export async function previewSetup(
  workspaceId: string,
  sessionId: string,
  target: AgentSetupReference,
): Promise<SetupPreview> {
  const params = new URLSearchParams({
    targetSetupId: target.id,
    targetSetupVersion: String(target.version),
  })
  return getApi().get<SetupPreview>(`/workspaces/${workspaceId}/sessions/${sessionId}/setup-preview?${params}`)
}

export async function listWorkspaceSetupTransitions(workspaceId: string): Promise<SetupTransitionHistory> {
  return getApi().get<SetupTransitionHistory>(`/workspaces/${workspaceId}/setup-transitions`)
}

export async function listSessionSetupTransitions(workspaceId: string, sessionId: string): Promise<SetupTransitionHistory> {
  return getApi().get<SetupTransitionHistory>(`/workspaces/${workspaceId}/sessions/${sessionId}/setup-transitions`)
}

export type WorkspaceKind = 'REPO_BACKED' | 'SCRATCH' | 'CHAT'

export interface CreateWorkspaceInput {
  name: string
  /**
   * Workspace flavour. `REPO_BACKED` clones a repo (needs
   * `repositoryId` or the legacy `repoUrl`). `SCRATCH` spins up a
   * Pod with no clone — useful for ad-hoc shell work.
   */
  kind?: WorkspaceKind
  /**
   * The preferred way to bind a workspace to a repo + its deploy key.
   * When set, the API derives `repoUrl` and `branch` from the
   * repository row.
   */
  repositoryId?: string | null
  /** Primary repository for multi-repo workspace creation. */
  primaryRepositoryId?: string | null
  /** Selected repositories for multi-repo workspace creation. */
  repositoryIds?: string[]
  /**
   * Optional project context. Set when the workspace was opened from
   * a project's UI; null for ad-hoc / scratch work.
   */
  projectId?: string | null
  /** Override of the repository's default branch. */
  branch?: string | null
  /** Ad-hoc workspaces still take a raw URL. */
  repoUrl?: string | null
  /**
   * @deprecated — prefer `repositoryId`. The server accepts both for
   * the migration window; PR H will drop this once the OpenAPI gate
   * lands.
   */
  githubLinkId?: string | null
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  return getApi().post<Workspace>('/workspaces', input)
}

export async function destroyWorkspace(id: string): Promise<void> {
  return getApi().del(`/workspaces/${id}`)
}

export async function attachRepository(workspaceId: string, repositoryId: string): Promise<void> {
  await getApi().post(`/workspaces/${workspaceId}/repositories`, { repositoryId })
}

export async function detachRepository(workspaceId: string, repositoryId: string): Promise<void> {
  await getApi().del(`/workspaces/${workspaceId}/repositories/${repositoryId}`)
}

export async function startSession(
  workspaceId: string,
  kind: AgentKind,
  onWaiting?: (retryInSeconds: number) => void,
): Promise<{ sessionId: string }> {
  const deadline = Date.now() + SESSION_START_BUDGET_MS
  for (;;) {
    try {
      return await getApi().post<{ sessionId: string }>(`/workspaces/${workspaceId}/sessions`, { kind })
    } catch (err) {
      if (err instanceof ApiError && err.status === 503 && Date.now() < deadline && isRetryable503(err)) {
        const waitSeconds = Math.max(1, err.problem.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_S)
        onWaiting?.(waitSeconds)
        await delay(waitSeconds * 1000)
        continue
      }
      throw err
    }
  }
}

export async function stopSession(workspaceId: string, sessionId: string): Promise<void> {
  return getApi().del(`/workspaces/${workspaceId}/sessions/${sessionId}`)
}

export async function restartSession(
  workspaceId: string,
  sessionId: string,
  input?: RestartSessionRequest | number,
): Promise<RestartSessionResponse> {
  const body = typeof input === 'number' ? { expectedGeneration: input } : compactRestartSessionRequest(input)
  return getApi().post<RestartSessionResponse>(`/workspaces/${workspaceId}/sessions/${sessionId}/restart`, body)
}

export type RestartSessionRequest = components['schemas']['RestartAgentSessionHttpRequest']

function compactRestartSessionRequest(input: RestartSessionRequest | undefined): RestartSessionRequest {
  if (!input) return {}
  const body: RestartSessionRequest = {}
  if (input.expectedGeneration !== undefined) body.expectedGeneration = input.expectedGeneration
  if (input.expectedEpoch !== undefined) body.expectedEpoch = input.expectedEpoch
  if (input.expectedSetupId !== undefined) body.expectedSetupId = input.expectedSetupId
  if (input.expectedSetupVersion !== undefined) body.expectedSetupVersion = input.expectedSetupVersion
  if (input.expectedCurrentSetupId !== undefined) body.expectedCurrentSetupId = input.expectedCurrentSetupId
  if (input.expectedCurrentSetupVersion !== undefined) body.expectedCurrentSetupVersion = input.expectedCurrentSetupVersion
  if (input.targetSetupId !== undefined) body.targetSetupId = input.targetSetupId
  if (input.targetSetupVersion !== undefined) body.targetSetupVersion = input.targetSetupVersion
  return body
}

export function agentSetupValidationProblemFromError(err: unknown): AgentSetupValidationProblem | null {
  if (!(err instanceof ApiError)) return null
  if (err.status !== 422) return null
  const problem = err.problem
  if (problem.type !== AGENT_SETUP_VALIDATION_TYPE) return null
  return problem as AgentSetupValidationProblem // eslint-disable-line ts/consistent-type-assertions
}

export async function getTurns(workspaceId: string, sessionId: string): Promise<Turn[]> {
  return getApi().get<Turn[]>(`/workspaces/${workspaceId}/sessions/${sessionId}/turns`)
}

export async function sendInput(workspaceId: string, sessionId: string, text: string, enter = true): Promise<void> {
  return getApi().post(`/workspaces/${workspaceId}/sessions/${sessionId}/input`, { text, enter })
}

export async function stageInput(
  workspaceId: string,
  sessionId: string,
  content: string,
  name?: string | null,
): Promise<StagedInput> {
  return getApi().post<StagedInput>(`/workspaces/${workspaceId}/sessions/${sessionId}/staged-inputs`, {
    content,
    name: name?.trim() || null,
  })
}
