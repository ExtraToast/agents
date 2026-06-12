import type { AgentSession, Workspace } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionConsoleViewModelsStore } from '../stores/sessionConsoleViewModels'
import { useSessionLabelsStore } from '../stores/sessionLabels'
import { useSessionStatusesStore } from '../stores/sessionStatuses'
import { useWorkspacesStore } from '../stores/workspaces'

function fakeWorkspace(over: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'demo',
    repoUrl: null,
    branch: null,
    podName: null,
    gatewayEndpoint: null,
    status: 'READY',
    kind: 'REPO_BACKED',
    projectId: null,
    repositoryId: null,
    githubLinkId: null,
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
    ...over,
  }
}

function fakeSession(over: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'sess-123456',
    workspaceId: 'ws-1',
    kind: 'CODEX',
    gatewayAgentId: 'agent-1',
    status: 'RUNNING',
    idle: false,
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
    ...over,
  }
}

describe('useSessionConsoleViewModelsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('derives active console sessions with labels and terminal affordances', () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    workspaces.activeSessionId = 'sess-123456'
    workspaces.sessions = [fakeSession()]
    useSessionLabelsStore().rename('sess-123456', 'backend')
    useSessionStatusesStore().syncRestSessions()

    const viewModels = useSessionConsoleViewModelsStore()

    expect(viewModels.sessions).toHaveLength(1)
    expect(viewModels.sessions[0]).toMatchObject({
      id: 'sess-123456',
      shortId: 'sess-123',
      label: 'backend',
      kindLabel: 'Codex',
      isActive: true,
      isLive: true,
      canAttachTerminal: true,
      canStop: true,
    })
    expect(viewModels.activeSession?.id).toBe('sess-123456')
  })

  it('uses non-color status metadata for each status state', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [
      fakeSession({ id: 'starting', status: 'STARTING', idle: false }),
      fakeSession({ id: 'running', status: 'RUNNING', idle: false }),
      fakeSession({ id: 'idle', status: 'RUNNING', idle: true }),
      fakeSession({ id: 'stopped', status: 'STOPPED', idle: false }),
      fakeSession({ id: 'failed', status: 'FAILED', idle: false }),
    ]
    useSessionStatusesStore().syncRestSessions()

    const byId = Object.fromEntries(useSessionConsoleViewModelsStore().sessions.map((session) => [session.id, session]))

    expect(byId.starting!.affordance).toMatchObject({ text: 'Starting', icon: 'loader', shape: 'ring' })
    expect(byId.running!.affordance).toMatchObject({ text: 'Running', icon: 'play', shape: 'dot' })
    expect(byId.idle!.affordance).toMatchObject({ text: 'Idle', icon: 'pause', shape: 'ring' })
    expect(byId.stopped!.affordance).toMatchObject({ text: 'Stopped', icon: 'square', shape: 'square' })
    expect(byId.failed!.affordance).toMatchObject({ text: 'Failed', icon: 'triangle-alert', shape: 'diamond' })
  })

  it('reflects SSE overlays in the derived model', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession({ status: 'RUNNING', updatedAt: '2026-06-12T10:00:00Z' })]
    const statuses = useSessionStatusesStore()
    statuses.syncRestSessions()
    statuses.applyStatus({
      sessionId: 'sess-123456',
      status: 'FAILED',
      idle: false,
      ts: '2026-06-12T10:05:00Z',
    })

    const session = useSessionConsoleViewModelsStore().sessions[0]

    expect(session?.status).toBe('FAILED')
    expect(session?.canAttachTerminal).toBe(false)
    expect(session?.affordance.ariaLabel).toBe('Session failed')
  })
})
