import type { CreateWorkspaceInput, RestartSessionRequest } from '../services/workspaceService'
import type {
  AgentKind,
  AgentSession,
  RestartSessionResponse,
  RunnerReadiness,
  Turn,
  Workspace,
  WorkspaceDetailWorkspace,
} from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@/lib/vueWebCommons'
import * as workspaceService from '../services/workspaceService'

const ACTIVE_SESSION_STORAGE_KEY = 'agents-ui:workspace-active-session'

export type RestartSessionState
  = | 'idle'
    | 'confirm-pending'
    | 'in-progress'
    | 'reconnecting'
    | 'reattaching'
    | 'replaying-history'
    | 'live'
    | 'failed'

const RECONNECTING_TIMEOUT_MS = 180_000

function isLiveSession(session: AgentSession): boolean {
  return session.status === 'STARTING' || session.status === 'RUNNING'
}

function isRestartReconnectError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 503 && err.problem.runnerStatus === 'not_ready_after_provision'
}

function parseStoredSessions(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Record<string, string> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string') result[key] = entry
    }
    return result
  } catch {
    return {}
  }
}

function readPreferredSession(workspaceId: string): string | null {
  try {
    const values = parseStoredSessions(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY))
    const value = values[workspaceId]
    return value ?? null
  } catch {
    return null
  }
}

function writePreferredSession(workspaceId: string, sessionId: string): void {
  try {
    const values = parseStoredSessions(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY))
    values[workspaceId] = sessionId
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(values))
  } catch {
    // Preference only; keep the store usable when localStorage is unavailable.
  }
}

function chooseActiveSession(all: AgentSession[], preferredId: string | null): string | null {
  const live = all.filter(isLiveSession)
  if (preferredId && live.some((s) => s.id === preferredId)) return preferredId
  if (preferredId && live.length === 0 && all.some((s) => s.id === preferredId)) {
    return preferredId
  }
  return live[0]?.id ?? all[0]?.id ?? null
}

function withRepositoryList(workspace: WorkspaceDetailWorkspace): WorkspaceDetailWorkspace {
  return {
    ...workspace,
    repositories: workspace.repositories ?? [],
  }
}

export const useWorkspacesStore = defineStore('workspaces', () => {
  const workspaces = ref<Workspace[]>([])
  const activeWorkspace = ref<WorkspaceDetailWorkspace | null>(null)
  const sessions = ref<AgentSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const turns = ref<Turn[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  // True while a new session's runner is cold-starting (start-session
  // is polling through the runner's not-ready 503 window).
  const startingSession = ref(false)
  const runnerReadiness = ref<RunnerReadiness>('unknown')
  // De-dup concurrent start requests for the same workspace+kind so that
  // double-clicks or rapid re-renders share one in-flight POST /sessions.
  const startingSessionByKey = new Map<string, Promise<string | null>>()
  const restartStates = ref<Record<string, RestartSessionState>>({})
  const restartReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function restartStateFor(sessionId: string): RestartSessionState {
    return restartStates.value[sessionId] ?? 'idle'
  }

  function clearRestartReconnectTimer(sessionId: string): void {
    const timer = restartReconnectTimers.get(sessionId)
    if (!timer) return
    clearTimeout(timer)
    restartReconnectTimers.delete(sessionId)
  }

  function setRestartState(sessionId: string, state: RestartSessionState): void {
    clearRestartReconnectTimer(sessionId)
    restartStates.value = {
      ...restartStates.value,
      [sessionId]: state,
    }
  }

  function clearRestartState(sessionId: string): void {
    clearRestartReconnectTimer(sessionId)
    const next = { ...restartStates.value }
    delete next[sessionId]
    restartStates.value = next
  }

  function requestRestartConfirmation(sessionId: string): void {
    setRestartState(sessionId, 'confirm-pending')
  }

  function cancelRestartConfirmation(sessionId: string): void {
    clearRestartState(sessionId)
  }

  function markRestartReattaching(sessionId: string): void {
    setRestartState(sessionId, 'reattaching')
  }

  function markRestartReconnecting(sessionId: string): void {
    setRestartState(sessionId, 'reconnecting')
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (restartStateFor(sessionId) === 'reconnecting') markRestartFailed(sessionId)
    }, RECONNECTING_TIMEOUT_MS)
    restartReconnectTimers.set(sessionId, timer)
  }

  function markRestartReplayingHistory(sessionId: string): void {
    setRestartState(sessionId, 'replaying-history')
  }

  function markRestartLive(sessionId: string): void {
    setRestartState(sessionId, 'live')
  }

  function markRestartFailed(sessionId: string): void {
    setRestartState(sessionId, 'failed')
  }

  async function loadAll(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      workspaces.value = await workspaceService.listWorkspaces()
    } catch {
      error.value = 'Failed to load workspaces'
    } finally {
      isLoading.value = false
    }
  }

  async function open(id: string, options: { loadTurns?: boolean; connectRunner?: boolean } = {}): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      if (options.connectRunner !== false) {
        try {
          const connect = await workspaceService.connectWorkspace(id)
          runnerReadiness.value = connect.state === 'READY' ? 'ready' : 'booting'
        } catch {
          runnerReadiness.value = 'failed'
        }
      }
      const detail = await workspaceService.getWorkspace(id)
      const preferredId = activeWorkspace.value?.id === id ? activeSessionId.value : readPreferredSession(id)
      activeWorkspace.value = withRepositoryList(detail.workspace)
      sessions.value = detail.sessions
      activeSessionId.value = chooseActiveSession(sessions.value, preferredId)
      if (activeSessionId.value) {
        writePreferredSession(id, activeSessionId.value)
        if (options.loadTurns !== false) {
          await loadTurns(activeSessionId.value)
        }
      } else {
        turns.value = []
      }
    } catch {
      error.value = 'Failed to load workspace'
    } finally {
      isLoading.value = false
    }
  }

  async function create(input: CreateWorkspaceInput): Promise<Workspace> {
    const ws = await workspaceService.createWorkspace(input)
    workspaces.value.unshift(ws)
    return ws
  }

  async function destroy(id: string): Promise<void> {
    await workspaceService.destroyWorkspace(id)
    workspaces.value = workspaces.value.filter((w) => w.id !== id)
    if (activeWorkspace.value?.id === id) {
      activeWorkspace.value = null
      sessions.value = []
      activeSessionId.value = null
      turns.value = []
    }
  }

  async function newSession(kind: AgentKind): Promise<string | null> {
    const ws = activeWorkspace.value
    if (!ws) return null
    const key = `${ws.id}:${kind}`
    const inflight = startingSessionByKey.get(key)
    if (inflight) return inflight
    const promise = startNewSession(ws.id, kind)
    startingSessionByKey.set(key, promise)
    try {
      return await promise
    } finally {
      startingSessionByKey.delete(key)
    }
  }

  async function startNewSession(workspaceId: string, kind: AgentKind): Promise<string | null> {
    startingSession.value = true
    try {
      const { sessionId } = await workspaceService.startSession(workspaceId, kind, () => {
        startingSession.value = true
      })
      activeSessionId.value = sessionId
      writePreferredSession(workspaceId, sessionId)
      await open(workspaceId, { connectRunner: false })
      return sessionId
    } catch (err) {
      // A non-retryable 503 means the runner is unavailable in a way the
      // retry loop does not handle; refresh the snapshot so the UI reflects
      // the current session/runner state without triggering a new connect.
      if (err instanceof ApiError && err.status === 503) {
        try {
          await open(workspaceId, { connectRunner: false, loadTurns: false })
        } catch {
          /* ignore */
        }
      }
      throw err
    } finally {
      startingSession.value = false
    }
  }

  async function endSession(sessionId: string): Promise<void> {
    const ws = activeWorkspace.value
    if (!ws) return
    await workspaceService.stopSession(ws.id, sessionId)
    if (activeSessionId.value === sessionId) activeSessionId.value = null
    await open(ws.id, { connectRunner: false })
  }

  async function restartSession(sessionId: string, expectedGeneration?: number): Promise<RestartSessionResponse | null> {
    const ws = activeWorkspace.value
    if (!ws) return null
    const previousActiveId = activeSessionId.value
    const session = sessions.value.find((s) => s.id === sessionId)
    const generation = expectedGeneration ?? session?.generation
    const request: RestartSessionRequest = {}
    if (generation !== undefined) request.expectedGeneration = generation
    if (session?.epoch !== undefined) request.expectedEpoch = session.epoch
    if (session?.currentSetup) {
      request.expectedSetupId = session.currentSetup.id
      request.expectedSetupVersion = session.currentSetup.version
    }
    setRestartState(sessionId, 'in-progress')
    try {
      const restarted = await workspaceService.restartSession(ws.id, sessionId, request)
      if (!previousActiveId) {
        activeSessionId.value = restarted.sessionId
        writePreferredSession(ws.id, restarted.sessionId)
      }
      markRestartReattaching(sessionId)
      await open(ws.id, { loadTurns: false, connectRunner: false })
      return restarted
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        markRestartReattaching(sessionId)
        await open(ws.id, { loadTurns: false, connectRunner: false })
        return null
      }
      if (isRestartReconnectError(err)) {
        markRestartReconnecting(sessionId)
        await open(ws.id, { loadTurns: false, connectRunner: false })
        return null
      }
      markRestartFailed(sessionId)
      throw err
    }
  }

  async function loadTurns(sessionId: string): Promise<void> {
    const ws = activeWorkspace.value
    if (!ws) return
    turns.value = await workspaceService.getTurns(ws.id, sessionId)
  }

  async function attachRepository(repositoryId: string): Promise<void> {
    const ws = activeWorkspace.value
    if (!ws) return
    await workspaceService.attachRepository(ws.id, repositoryId)
    await open(ws.id, { connectRunner: false })
  }

  async function detachRepository(repositoryId: string): Promise<void> {
    const ws = activeWorkspace.value
    if (!ws) return
    await workspaceService.detachRepository(ws.id, repositoryId)
    activeWorkspace.value = {
      ...ws,
      repositories: (ws.repositories ?? []).filter((r) => r.id !== repositoryId),
    }
    await open(ws.id, { connectRunner: false })
  }

  function selectSession(sessionId: string): void {
    activeSessionId.value = sessionId
    if (activeWorkspace.value) writePreferredSession(activeWorkspace.value.id, sessionId)
  }

  function appendStreamedOutput(text: string): void {
    if (!activeSessionId.value) return
    const last = turns.value[turns.value.length - 1]
    if (last && last.role === 'AGENT' && last.id.startsWith('stream-')) {
      last.body += text
    } else {
      turns.value.push({
        id: `stream-${crypto.randomUUID()}`,
        sessionId: activeSessionId.value,
        role: 'AGENT',
        body: text,
        createdAt: new Date().toISOString(),
      })
    }
  }

  function appendUserTurn(text: string): void {
    if (!activeSessionId.value) return
    turns.value.push({
      id: `local-${crypto.randomUUID()}`,
      sessionId: activeSessionId.value,
      role: 'USER',
      body: text,
      createdAt: new Date().toISOString(),
    })
  }

  return {
    workspaces,
    activeWorkspace,
    sessions,
    activeSessionId,
    turns,
    isLoading,
    error,
    startingSession,
    runnerReadiness,
    restartStates,
    loadAll,
    open,
    create,
    destroy,
    newSession,
    endSession,
    restartSession,
    loadTurns,
    attachRepository,
    detachRepository,
    selectSession,
    restartStateFor,
    setRestartState,
    clearRestartState,
    requestRestartConfirmation,
    cancelRestartConfirmation,
    markRestartReattaching,
    markRestartReconnecting,
    markRestartReplayingHistory,
    markRestartLive,
    markRestartFailed,
    appendStreamedOutput,
    appendUserTurn,
  }
})
