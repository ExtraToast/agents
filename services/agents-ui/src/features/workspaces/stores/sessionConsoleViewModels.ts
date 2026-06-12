import type { AgentKind, AgentSession, AgentSessionStatus } from '../types'
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useSessionLabelsStore } from './sessionLabels'
import { useSessionStatusesStore } from './sessionStatuses'
import { useWorkspacesStore } from './workspaces'

export type SessionStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type SessionStatusShape = 'dot' | 'ring' | 'square' | 'diamond'

export interface SessionStatusAffordance {
  text: string
  ariaLabel: string
  description: string
  icon: string
  shape: SessionStatusShape
  tone: SessionStatusTone
}

export interface SessionConsoleViewModel {
  id: string
  shortId: string
  label: string
  kind: AgentKind
  kindLabel: string
  status: AgentSessionStatus
  idle: boolean
  isActive: boolean
  isLive: boolean
  canAttachTerminal: boolean
  canStop: boolean
  affordance: SessionStatusAffordance
}

const KIND_LABELS: Record<AgentKind, string> = {
  CLAUDE: 'Claude Code',
  CODEX: 'Codex',
  SHELL: 'Shell',
}

function statusAffordance(session: AgentSession): SessionStatusAffordance {
  if (session.status === 'STARTING') {
    return {
      text: 'Starting',
      ariaLabel: 'Session is starting',
      description: 'Runner is starting',
      icon: 'loader',
      shape: 'ring',
      tone: 'info',
    }
  }
  if (session.status === 'RUNNING' && session.idle) {
    return {
      text: 'Idle',
      ariaLabel: 'Session is running but idle',
      description: 'Runner is waiting for an agent binding',
      icon: 'pause',
      shape: 'ring',
      tone: 'warning',
    }
  }
  if (session.status === 'RUNNING') {
    return {
      text: 'Running',
      ariaLabel: 'Session is running',
      description: 'Terminal is available',
      icon: 'play',
      shape: 'dot',
      tone: 'success',
    }
  }
  if (session.status === 'FAILED') {
    return {
      text: 'Failed',
      ariaLabel: 'Session failed',
      description: 'Session ended with an error',
      icon: 'triangle-alert',
      shape: 'diamond',
      tone: 'danger',
    }
  }
  return {
    text: 'Stopped',
    ariaLabel: 'Session stopped',
    description: 'Session has ended',
    icon: 'square',
    shape: 'square',
    tone: 'neutral',
  }
}

export const useSessionConsoleViewModelsStore = defineStore('sessionConsoleViewModels', () => {
  const workspaces = useWorkspacesStore()
  const labels = useSessionLabelsStore()
  const statuses = useSessionStatusesStore()

  const sessions = computed<SessionConsoleViewModel[]>(() =>
    statuses.mergedSessions.map((session) => {
      const isLive = session.status === 'STARTING' || session.status === 'RUNNING'
      return {
        id: session.id,
        shortId: session.id.slice(0, 8),
        label: labels.labelFor(session.id) ?? session.id.slice(0, 8),
        kind: session.kind,
        kindLabel: KIND_LABELS[session.kind],
        status: session.status,
        idle: session.idle ?? false,
        isActive: workspaces.activeSessionId === session.id,
        isLive,
        canAttachTerminal: isLive,
        canStop: session.status === 'RUNNING',
        affordance: statusAffordance(session),
      }
    }),
  )

  const activeSession = computed(() => sessions.value.find((session) => session.isActive) ?? null)

  return {
    sessions,
    activeSession,
  }
})
