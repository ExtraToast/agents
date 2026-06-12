import type { AgentSession } from '../types'
import type { SessionRemoveEvent, SessionStatusEvent, SessionStatusStream } from '../services/sessionStatusStream'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { openSessionStatusStream } from '../services/sessionStatusStream'
import { useWorkspacesStore } from './workspaces'

export type SessionStatusConnectionState = 'idle' | 'connecting' | 'open' | 'error'

export interface SessionStatusOverlay {
  status: AgentSession['status']
  idle: boolean
  ts: string
}

const LIVE_STATUSES = new Set<AgentSession['status']>(['STARTING', 'RUNNING'])

function eventTime(ts: string | undefined): number | null {
  if (!ts) return null
  const parsed = Date.parse(ts)
  return Number.isFinite(parsed) ? parsed : null
}

function sessionLabel(session: AgentSession): string {
  if (session.status === 'RUNNING' && session.idle) return 'Idle'
  const lower = session.status.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export const useSessionStatusesStore = defineStore('sessionStatuses', () => {
  const workspaces = useWorkspacesStore()

  const connectionState = ref<SessionStatusConnectionState>('idle')
  const connectionError = ref<string | null>(null)
  const lastKeepaliveAt = ref<string | null>(null)
  const malformedEvents = ref(0)
  const overlays = ref<Record<string, SessionStatusOverlay>>({})
  const removedAt = ref<Record<string, string>>({})
  const lastTsBySessionId = ref<Record<string, string>>({})
  const workspaceId = ref<string | null>(null)
  let stream: SessionStatusStream | null = null
  let pendingRefresh: Promise<void> | null = null

  const isConnected = computed(() => connectionState.value === 'open')

  const mergedSessions = computed<AgentSession[]>(() =>
    workspaces.sessions
      .filter((session) => !removedAt.value[session.id])
      .map((session) => {
        const overlay = overlays.value[session.id]
        return overlay
          ? {
              ...session,
              status: overlay.status,
              idle: overlay.idle,
              updatedAt: overlay.ts,
            }
          : session
      }),
  )

  const liveSessions = computed(() => mergedSessions.value.filter((session) => LIVE_STATUSES.has(session.status)))

  const accessibleStatusLabels = computed<Record<string, string>>(() =>
    Object.fromEntries(mergedSessions.value.map((session) => [session.id, sessionLabel(session)])),
  )

  function isKnownSession(sessionId: string): boolean {
    return workspaces.sessions.some((session) => session.id === sessionId)
  }

  function isOlder(sessionId: string, ts: string): boolean {
    const next = eventTime(ts)
    const current = eventTime(lastTsBySessionId.value[sessionId])
    return next !== null && current !== null && next < current
  }

  function rememberTs(sessionId: string, ts: string): void {
    lastTsBySessionId.value = {
      ...lastTsBySessionId.value,
      [sessionId]: ts,
    }
  }

  function applyStatus(event: SessionStatusEvent): void {
    if (eventTime(event.ts) === null) return
    if (!isKnownSession(event.sessionId) || isOlder(event.sessionId, event.ts)) return

    overlays.value = {
      ...overlays.value,
      [event.sessionId]: {
        status: event.status,
        idle: event.idle,
        ts: event.ts,
      },
    }
    const nextRemoved = { ...removedAt.value }
    delete nextRemoved[event.sessionId]
    removedAt.value = nextRemoved
    rememberTs(event.sessionId, event.ts)
  }

  function applyRemove(event: SessionRemoveEvent): void {
    if (eventTime(event.ts) === null) return
    if (!isKnownSession(event.sessionId) || isOlder(event.sessionId, event.ts)) return

    const nextOverlays = { ...overlays.value }
    delete nextOverlays[event.sessionId]
    overlays.value = nextOverlays
    removedAt.value = {
      ...removedAt.value,
      [event.sessionId]: event.ts,
    }
    rememberTs(event.sessionId, event.ts)
  }

  function syncRestSessions(sessions: AgentSession[] = workspaces.sessions): void {
    const known = new Set(sessions.map((session) => session.id))
    const nextOverlays: Record<string, SessionStatusOverlay> = {}
    const nextRemoved: Record<string, string> = {}
    const nextTs: Record<string, string> = {}

    for (const session of sessions) {
      const overlay = overlays.value[session.id]
      const overlayTime = eventTime(overlay?.ts)
      const restTime = eventTime(session.updatedAt)
      if (overlay && (restTime === null || overlayTime === null || overlayTime > restTime)) {
        nextOverlays[session.id] = overlay
        nextTs[session.id] = overlay.ts
      } else if (restTime !== null) {
        nextTs[session.id] = session.updatedAt
      }

      const removedTime = eventTime(removedAt.value[session.id])
      if (removedTime !== null && (restTime === null || removedTime > restTime)) {
        nextRemoved[session.id] = removedAt.value[session.id]!
        nextTs[session.id] = removedAt.value[session.id]!
      }
    }

    for (const [sessionId, ts] of Object.entries(lastTsBySessionId.value)) {
      if (!known.has(sessionId)) continue
      if (!nextTs[sessionId]) nextTs[sessionId] = ts
    }

    overlays.value = nextOverlays
    removedAt.value = nextRemoved
    lastTsBySessionId.value = nextTs
  }

  async function refreshActiveWorkspaceSnapshot(): Promise<void> {
    const id = workspaceId.value ?? workspaces.activeWorkspace?.id
    if (!id) return
    await workspaces.open(id)
    syncRestSessions()
  }

  function refreshOnConnect(): void {
    pendingRefresh = refreshActiveWorkspaceSnapshot().catch(() => {
      connectionError.value = 'Failed to refresh workspace status'
    })
  }

  function connect(): void {
    if (stream) return
    workspaceId.value = workspaceId.value ?? workspaces.activeWorkspace?.id ?? null
    connectionState.value = 'connecting'
    connectionError.value = null
    stream = openSessionStatusStream({
      onOpen() {
        connectionState.value = 'open'
        connectionError.value = null
        refreshOnConnect()
      },
      onError() {
        connectionState.value = 'error'
        connectionError.value = 'Session status stream disconnected'
      },
      onStatus: applyStatus,
      onRemove: applyRemove,
      onKeepalive(event) {
        lastKeepaliveAt.value = event.ts ?? new Date().toISOString()
      },
      onMalformed() {
        malformedEvents.value += 1
      },
    })
  }

  function disconnect(): void {
    stream?.close()
    stream = null
    pendingRefresh = null
    connectionState.value = 'idle'
    connectionError.value = null
  }

  function useWorkspace(id: string | null): void {
    if (workspaceId.value === id) return
    workspaceId.value = id
    overlays.value = {}
    removedAt.value = {}
    lastTsBySessionId.value = {}
    if (id) {
      disconnect()
      connect()
    } else {
      disconnect()
    }
  }

  async function waitForRefresh(): Promise<void> {
    await (pendingRefresh ?? Promise.resolve())
  }

  function statusLabelFor(session: AgentSession): string {
    const overlay = overlays.value[session.id]
    return sessionLabel(overlay ? { ...session, status: overlay.status, idle: overlay.idle } : session)
  }

  return {
    connectionState,
    connectionError,
    isConnected,
    lastKeepaliveAt,
    malformedEvents,
    overlays,
    removedAt,
    lastTsBySessionId,
    mergedSessions,
    liveSessions,
    accessibleStatusLabels,
    connect,
    disconnect,
    useWorkspace,
    waitForRefresh,
    syncRestSessions,
    applyStatus,
    applyRemove,
    statusLabelFor,
  }
})
