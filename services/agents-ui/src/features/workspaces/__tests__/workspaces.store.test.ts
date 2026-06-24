import type { AgentSession, AgentSetupValidationProblem, Workspace, WorkspaceDetail, WorkspaceRepository } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/vueWebCommons'
import {
  agentSetupValidationProblemFromError,
  attachRepository,
  connectWorkspace,
  createWorkspace,
  destroyWorkspace,
  detachRepository,
  getTurns,
  getWorkspace,
  listSetupOptions,
  listWorkspaces,
  previewSetup,
  restartSession,
  startSession,
} from '../services/workspaceService'

import { useWorkspacesStore } from '../stores/workspaces'

vi.mock('../services/workspaceService', () => ({
  listWorkspaces: vi.fn(),
  getWorkspace: vi.fn(),
  connectWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  destroyWorkspace: vi.fn(),
  attachRepository: vi.fn(),
  detachRepository: vi.fn(),
  startSession: vi.fn(),
  restartSession: vi.fn(),
  listSetupOptions: vi.fn(),
  previewSetup: vi.fn(),
  agentSetupValidationProblemFromError: vi.fn(),
  stopSession: vi.fn(),
  getTurns: vi.fn(),
  sendInput: vi.fn(),
}))

const mocked = {
  listWorkspaces: vi.mocked(listWorkspaces),
  getWorkspace: vi.mocked(getWorkspace),
  connectWorkspace: vi.mocked(connectWorkspace),
  createWorkspace: vi.mocked(createWorkspace),
  destroyWorkspace: vi.mocked(destroyWorkspace),
  attachRepository: vi.mocked(attachRepository),
  detachRepository: vi.mocked(detachRepository),
  startSession: vi.mocked(startSession),
  restartSession: vi.mocked(restartSession),
  listSetupOptions: vi.mocked(listSetupOptions),
  previewSetup: vi.mocked(previewSetup),
  agentSetupValidationProblemFromError: vi.mocked(agentSetupValidationProblemFromError),
  getTurns: vi.mocked(getTurns),
}

function fakeWorkspace(over: Partial<Workspace> = {}): Workspace {
  return {
    id: '11111111-1111-1111-1111-111111111111',
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
    createdAt: '2026-05-19T10:00:00Z',
    updatedAt: '2026-05-19T10:00:00Z',
    ...over,
  }
}

function fakeSession(over: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'sess-1',
    workspaceId: '11111111-1111-1111-1111-111111111111',
    kind: 'CLAUDE',
    gatewayAgentId: 'abc',
    epoch: 1,
    generation: 0,
    status: 'RUNNING',
    currentSetup: { id: 'setup-current', version: 1 },
    pendingSetup: null,
    createdAt: '2026-05-19T10:00:00Z',
    updatedAt: '2026-05-19T10:00:00Z',
    ...over,
  }
}

function fakePreview(target = { id: 'setup-current', version: 1 }) {
  return {
    current: { id: 'setup-current', version: 1 },
    target,
    diff: {
      from: { id: 'setup-current', version: 1 },
      to: target,
      hasChanges: target.id !== 'setup-current' || target.version !== 1,
      changes: [],
    },
    validation: {
      target,
      valid: true,
      issues: [],
      warnings: [],
    },
  }
}

function validationProblem(): AgentSetupValidationProblem {
  return {
    type: 'https://jorisjonkers.dev/errors/agent-setup-validation',
    title: 'Agent setup validation failed',
    status: 422,
    detail: 'Agent setup target is not valid for this workspace or session.',
    errors: [{ field: 'TARGET_NOT_SELECTABLE', message: 'TARGET_NOT_SELECTABLE', rejectedValue: null }],
  }
}

function fakeRepository(over: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    id: 'repo-1',
    name: 'demo-repo',
    repoUrl: 'git@github.com:owner/demo.git',
    defaultBranch: 'main',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
    isPrimary: false,
    attachedAt: '2026-05-20T10:00:00Z',
    ...over,
  }
}

function apiError(status: number): ApiError {
  return new ApiError({
    type: 'about:blank',
    title: 'x',
    status,
  })
}

describe('useWorkspacesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(mocked).forEach((m) => m.mockReset())
    mocked.connectWorkspace.mockResolvedValue({
      workspaceId: fakeWorkspace().id,
      setupId: 'setup-current',
      setupVersion: 1,
      state: 'READY',
      reason: null,
      checkedAt: '2026-06-17T08:00:00Z',
    })
    mocked.agentSetupValidationProblemFromError.mockImplementation((err) => {
      // eslint-disable-next-line ts/consistent-type-assertions -- narrow the commons ProblemDetail to the 422 subtype the helper guarantees
      if (err instanceof ApiError && err.status === 422) return err.problem as AgentSetupValidationProblem
      return null
    })
    localStorage.clear()
  })

  it('loadAll populates workspaces', async () => {
    mocked.listWorkspaces.mockResolvedValue([fakeWorkspace()])
    const store = useWorkspacesStore()
    await store.loadAll()
    expect(store.workspaces).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('open loads workspace + sessions and auto-selects first session turns', async () => {
    const detail: WorkspaceDetail = {
      workspace: { ...fakeWorkspace(), repositories: [] },
      sessions: [fakeSession()],
    }
    mocked.getWorkspace.mockResolvedValue(detail)
    mocked.getTurns.mockResolvedValue([])
    const store = useWorkspacesStore()
    await store.open('11111111-1111-1111-1111-111111111111')
    expect(store.sessions).toHaveLength(1)
    expect(store.activeSessionId).toBe('sess-1')
    expect(store.activeWorkspace?.repositories).toEqual([])
  })

  it('open defaults missing detail repositories to an empty list', async () => {
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [],
    })
    const store = useWorkspacesStore()
    await store.open('11111111-1111-1111-1111-111111111111')
    expect(store.activeWorkspace?.repositories).toEqual([])
  })

  it('open prefers a live session over a stopped first session after refresh', async () => {
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'stopped', status: 'STOPPED' }), fakeSession({ id: 'running', status: 'RUNNING' })],
    })
    mocked.getTurns.mockResolvedValue([])

    const store = useWorkspacesStore()
    await store.open('11111111-1111-1111-1111-111111111111')

    expect(store.activeSessionId).toBe('running')
  })

  it('open restores the previous live session for a workspace', async () => {
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-a', status: 'RUNNING' }), fakeSession({ id: 'sess-b', status: 'RUNNING' })],
    })
    mocked.getTurns.mockResolvedValue([])

    const store = useWorkspacesStore()
    await store.open('11111111-1111-1111-1111-111111111111')
    store.selectSession('sess-b')

    setActivePinia(createPinia())
    const freshStore = useWorkspacesStore()
    await freshStore.open('11111111-1111-1111-1111-111111111111')

    expect(freshStore.activeSessionId).toBe('sess-b')
  })

  it('open keeps a preferred retained session when no live session is available', async () => {
    localStorage.setItem(
      'agents-ui:workspace-active-session',
      JSON.stringify({ '11111111-1111-1111-1111-111111111111': 'failed' }),
    )
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'stopped', status: 'STOPPED' }), fakeSession({ id: 'failed', status: 'FAILED' })],
    })
    mocked.getTurns.mockResolvedValue([])

    const store = useWorkspacesStore()
    await store.open('11111111-1111-1111-1111-111111111111')

    expect(store.activeSessionId).toBe('failed')
    expect(mocked.getTurns).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'failed')
  })

  it('create unshifts the new workspace', async () => {
    const ws = fakeWorkspace({ id: 'new', name: 'fresh' })
    mocked.createWorkspace.mockResolvedValue(ws)
    const store = useWorkspacesStore()
    store.workspaces = [fakeWorkspace({ id: 'old' })]
    const result = await store.create({ name: 'fresh' })
    expect(result).toEqual(ws)
    expect(store.workspaces[0]!.id).toBe('new')
  })

  it('destroy removes workspace and clears active when matching', async () => {
    mocked.destroyWorkspace.mockResolvedValue()
    const store = useWorkspacesStore()
    const ws = fakeWorkspace({ id: 'a' })
    store.workspaces = [ws]
    store.activeWorkspace = ws
    await store.destroy('a')
    expect(store.workspaces).toHaveLength(0)
    expect(store.activeWorkspace).toBeNull()
  })

  it('attachRepository refreshes detail without reading an attach response body', async () => {
    const repo = fakeRepository({ id: 'repo-a' })
    mocked.attachRepository.mockResolvedValue()
    mocked.getWorkspace.mockResolvedValue({
      workspace: { ...fakeWorkspace(), repositories: [repo] },
      sessions: [],
    })

    const store = useWorkspacesStore()
    store.activeWorkspace = { ...fakeWorkspace(), repositories: [] }
    await store.attachRepository('repo-a')

    expect(mocked.attachRepository).toHaveBeenCalledWith(fakeWorkspace().id, 'repo-a')
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    expect(store.activeWorkspace?.repositories?.map((r) => r.id)).toEqual(['repo-a'])
  })

  it('attachRepository no-ops when no workspace is active', async () => {
    const store = useWorkspacesStore()
    await store.attachRepository('repo-a')
    expect(mocked.attachRepository).not.toHaveBeenCalled()
  })

  it('detachRepository removes from the active workspace and refreshes detail', async () => {
    const a = fakeRepository({ id: 'repo-a' })
    const b = fakeRepository({ id: 'repo-b' })
    mocked.detachRepository.mockResolvedValue()
    mocked.getWorkspace.mockResolvedValue({
      workspace: { ...fakeWorkspace(), repositories: [b] },
      sessions: [],
    })

    const store = useWorkspacesStore()
    store.activeWorkspace = { ...fakeWorkspace(), repositories: [a, b] }
    await store.detachRepository('repo-a')

    expect(mocked.detachRepository).toHaveBeenCalledWith(fakeWorkspace().id, 'repo-a')
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    expect(store.activeWorkspace?.repositories?.map((r) => r.id)).toEqual(['repo-b'])
  })

  it('detachRepository no-ops when no workspace is active', async () => {
    const store = useWorkspacesStore()
    await store.detachRepository('repo-a')
    expect(mocked.detachRepository).not.toHaveBeenCalled()
  })

  it('appendStreamedOutput appends to the trailing streamed turn rather than creating new ones', () => {
    const store = useWorkspacesStore()
    store.activeSessionId = 'sess-1'
    store.appendStreamedOutput('hello ')
    store.appendStreamedOutput('world')
    expect(store.turns).toHaveLength(1)
    expect(store.turns[0]!.body).toBe('hello world')
    expect(store.turns[0]!.role).toBe('AGENT')
  })

  it('appendUserTurn adds a USER row immediately', () => {
    const store = useWorkspacesStore()
    store.activeSessionId = 'sess-1'
    store.appendUserTurn('do the thing')
    expect(store.turns).toHaveLength(1)
    expect(store.turns[0]!.role).toBe('USER')
  })

  it('newSession returns the new id and refreshes the workspace', async () => {
    mocked.startSession.mockResolvedValue({ sessionId: 'sess-2' })
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    const id = await store.newSession('CODEX')
    expect(id).toBe('sess-2')
    expect(mocked.startSession).toHaveBeenCalledWith(fakeWorkspace().id, 'CODEX', expect.any(Function))
  })

  it('restartSession calls the restart route helper and refreshes the active workspace', async () => {
    mocked.restartSession.mockResolvedValue({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-1', status: 'RUNNING' })],
    })
    mocked.getTurns.mockResolvedValue([])
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    const restarted = await store.restartSession('sess-1', 3)

    expect(restarted).toEqual({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })
    expect(mocked.restartSession).toHaveBeenCalledWith(fakeWorkspace().id, 'sess-1', { expectedGeneration: 3 })
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    expect(store.activeSessionId).toBe('sess-1')
  })

  it('restartSession uses the current session generation when no override is provided', async () => {
    mocked.restartSession.mockResolvedValue({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-1', generation: 4, status: 'RUNNING' })],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-1'
    store.sessions = [fakeSession({ id: 'sess-1', generation: 3, status: 'RUNNING' })]

    await store.restartSession('sess-1')

    expect(mocked.restartSession).toHaveBeenCalledWith(fakeWorkspace().id, 'sess-1', {
      expectedGeneration: 3,
      expectedEpoch: 1,
      expectedSetupId: 'setup-current',
      expectedSetupVersion: 1,
      targetSetupId: 'setup-current',
      targetSetupVersion: 1,
    })
  })

  it('loads setup options and defaults restart target to the pending setup', async () => {
    mocked.listSetupOptions.mockResolvedValue({
      current: { id: 'setup-current', version: 1 },
      pending: { id: 'setup-next', version: 2 },
      options: [],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    const options = await store.loadSetupOptions('sess-1')

    expect(options?.pending).toEqual({ id: 'setup-next', version: 2 })
    expect(mocked.listSetupOptions).toHaveBeenCalledWith(fakeWorkspace().id, 'sess-1')
    expect(store.selectedRestartTargetFor('sess-1')).toEqual({ id: 'setup-next', version: 2 })
  })

  it('loads setup preview before moving restart into confirmation', async () => {
    const target = { id: 'setup-next', version: 2 }
    mocked.previewSetup.mockResolvedValue(fakePreview(target))
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.sessions = [fakeSession({ id: 'sess-1' })]
    store.selectRestartTarget('sess-1', target)

    await store.requestRestartConfirmation('sess-1')

    expect(mocked.previewSetup).toHaveBeenCalledWith(fakeWorkspace().id, 'sess-1', target)
    expect(store.setupPreviewsBySessionId['sess-1']?.target).toEqual(target)
    expect(store.restartStateFor('sess-1')).toBe('confirm-pending')
  })

  it('keeps setup validation problems from preview and does not confirm restart', async () => {
    const problem = validationProblem()
    const failure = new ApiError(problem)
    mocked.previewSetup.mockRejectedValue(failure)
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.sessions = [fakeSession({ id: 'sess-1' })]

    await store.requestRestartConfirmation('sess-1')

    expect(store.setupValidationProblemsBySessionId['sess-1']).toEqual(problem)
    expect(store.setupPreviewsBySessionId['sess-1']).toBeUndefined()
    expect(store.restartStateFor('sess-1')).toBe('failed')
  })

  it('submits selected restart target with setup and epoch preconditions', async () => {
    mocked.restartSession.mockResolvedValue({
      sessionId: 'sess-1',
      epoch: 2,
      generation: 4,
      status: 'RUNNING',
      currentSetup: { id: 'setup-next', version: 2 },
      pendingSetup: null,
    })
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-1', currentSetup: { id: 'setup-next', version: 2 } })],
    })
    const target = { id: 'setup-next', version: 2 }
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-1'
    store.sessions = [fakeSession({ id: 'sess-1', epoch: 8, generation: 3, currentSetup: { id: 'setup-current', version: 1 } })]
    store.selectRestartTarget('sess-1', target)

    await store.restartSession('sess-1')

    expect(mocked.restartSession).toHaveBeenCalledWith(fakeWorkspace().id, 'sess-1', {
      expectedGeneration: 3,
      expectedEpoch: 8,
      expectedSetupId: 'setup-current',
      expectedSetupVersion: 1,
      targetSetupId: 'setup-next',
      targetSetupVersion: 2,
    })
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
  })

  it('restartSession preserves the active session and leaves terminal history to websocket replay', async () => {
    mocked.restartSession.mockResolvedValue({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [
        fakeSession({ id: 'sess-1', generation: 4, status: 'RUNNING' }),
        fakeSession({ id: 'sess-2', status: 'RUNNING' }),
      ],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-2'
    store.sessions = [fakeSession({ id: 'sess-1', generation: 3 }), fakeSession({ id: 'sess-2' })]
    store.turns = [{ id: 'turn-1', sessionId: 'sess-2', role: 'AGENT', body: 'existing', createdAt: '2026-05-19T10:00:00Z' }]

    await store.restartSession('sess-1')

    expect(store.activeSessionId).toBe('sess-2')
    expect(mocked.getTurns).not.toHaveBeenCalled()
    expect(store.turns).toEqual([
      { id: 'turn-1', sessionId: 'sess-2', role: 'AGENT', body: 'existing', createdAt: '2026-05-19T10:00:00Z' },
    ])
  })

  it('restartSession refreshes the workspace snapshot on generation conflict', async () => {
    mocked.restartSession.mockRejectedValue(apiError(409))
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-1', generation: 4, status: 'RUNNING' })],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-1'
    store.sessions = [fakeSession({ id: 'sess-1', generation: 3, status: 'RUNNING' })]

    const restarted = await store.restartSession('sess-1')

    expect(restarted).toBeNull()
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    expect(store.sessions[0]?.generation).toBe(4)
    expect(store.restartStateFor('sess-1')).toBe('reattaching')
    expect(mocked.getTurns).not.toHaveBeenCalled()
  })

  it('models restart confirmation and terminal replay states', async () => {
    let resolveRestart: (value: { sessionId: string; epoch: number; generation: number; status: 'RUNNING' }) => void = () => {}
    mocked.restartSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestart = resolve
        }),
    )
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-1', generation: 4, status: 'RUNNING' })],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-1'
    store.sessions = [fakeSession({ id: 'sess-1', generation: 3, status: 'RUNNING' })]

    expect(store.restartStateFor('sess-1')).toBe('idle')
    mocked.previewSetup.mockResolvedValue(fakePreview())
    await store.requestRestartConfirmation('sess-1')
    expect(store.restartStateFor('sess-1')).toBe('confirm-pending')
    store.cancelRestartConfirmation('sess-1')
    expect(store.restartStateFor('sess-1')).toBe('idle')

    const pending = store.restartSession('sess-1')
    expect(store.restartStateFor('sess-1')).toBe('in-progress')
    resolveRestart!({ sessionId: 'sess-1', epoch: 2, generation: 4, status: 'RUNNING' })
    await pending

    expect(store.restartStateFor('sess-1')).toBe('reattaching')
    store.markRestartReplayingHistory('sess-1')
    expect(store.restartStateFor('sess-1')).toBe('replaying-history')
    store.markRestartLive('sess-1')
    expect(store.restartStateFor('sess-1')).toBe('live')
  })

  it('marks restart failed and keeps the active session when restart fails', async () => {
    const failure = apiError(500)
    mocked.restartSession.mockRejectedValue(failure)
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.activeSessionId = 'sess-2'
    store.sessions = [fakeSession({ id: 'sess-1', generation: 3 }), fakeSession({ id: 'sess-2' })]

    await expect(store.restartSession('sess-1')).rejects.toBe(failure)

    expect(store.activeSessionId).toBe('sess-2')
    expect(store.restartStateFor('sess-1')).toBe('failed')
    expect(mocked.getWorkspace).not.toHaveBeenCalled()
  })

  it('open calls connectWorkspace and sets runnerReadiness to ready when state is READY', async () => {
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    mocked.connectWorkspace.mockResolvedValue({
      workspaceId: fakeWorkspace().id,
      setupId: 'setup-current',
      setupVersion: 1,
      state: 'READY',
      reason: null,
      checkedAt: '2026-06-17T08:00:00Z',
    })
    const store = useWorkspacesStore()

    await store.open(fakeWorkspace().id)

    expect(mocked.connectWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    expect(store.runnerReadiness).toBe('ready')
  })

  it('open sets runnerReadiness to booting when connect state is not READY', async () => {
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    mocked.connectWorkspace.mockResolvedValue({
      workspaceId: fakeWorkspace().id,
      setupId: 'setup-current',
      setupVersion: 1,
      state: 'STARTING',
      reason: null,
      checkedAt: '2026-06-17T08:00:00Z',
    })
    const store = useWorkspacesStore()

    await store.open(fakeWorkspace().id)

    expect(store.runnerReadiness).toBe('booting')
  })

  it('open sets runnerReadiness to failed when connectWorkspace throws', async () => {
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    mocked.connectWorkspace.mockRejectedValue(apiError(503))
    const store = useWorkspacesStore()

    await store.open(fakeWorkspace().id)

    expect(store.runnerReadiness).toBe('failed')
    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
  })

  it('open skips connectWorkspace when connectRunner is false', async () => {
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()

    await store.open(fakeWorkspace().id, { connectRunner: false })

    expect(mocked.connectWorkspace).not.toHaveBeenCalled()
  })

  it('open does not auto-spawn a session when no sessions exist', async () => {
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()

    await store.open(fakeWorkspace().id)

    expect(mocked.startSession).not.toHaveBeenCalled()
    expect(store.sessions).toHaveLength(0)
  })

  it('newSession de-dups concurrent start calls for the same workspace and kind', async () => {
    let resolveStart: (value: { sessionId: string }) => void = () => {}
    mocked.startSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve
        }),
    )
    mocked.getWorkspace.mockResolvedValue({
      workspace: fakeWorkspace(),
      sessions: [fakeSession({ id: 'sess-new' })],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    const first = store.newSession('CLAUDE')
    const second = store.newSession('CLAUDE')

    resolveStart({ sessionId: 'sess-new' })
    const [id1, id2] = await Promise.all([first, second])

    expect(mocked.startSession).toHaveBeenCalledTimes(1)
    expect(id1).toBe('sess-new')
    expect(id2).toBe('sess-new')
  })

  it('newSession allows a new start after the previous one resolves', async () => {
    mocked.startSession
      .mockResolvedValueOnce({ sessionId: 'sess-1' })
      .mockResolvedValueOnce({ sessionId: 'sess-2' })
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    await store.newSession('CLAUDE')
    await store.newSession('CLAUDE')

    expect(mocked.startSession).toHaveBeenCalledTimes(2)
  })

  it('newSession refreshes snapshot without connectWorkspace on non-retryable 503', async () => {
    mocked.startSession.mockRejectedValue(apiError(503))
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    await expect(store.newSession('CLAUDE')).rejects.toBeDefined()

    expect(mocked.getWorkspace).toHaveBeenCalledWith(fakeWorkspace().id)
    // The snapshot refresh must not re-trigger a connect
    const connectCallCount = mocked.connectWorkspace.mock.calls.length
    expect(connectCallCount).toBe(0)
  })

  it('newSession clears startingSession to false after a failed start', async () => {
    mocked.startSession.mockRejectedValue(apiError(503))
    mocked.getWorkspace.mockResolvedValue({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()

    await expect(store.newSession('CLAUDE')).rejects.toBeDefined()

    expect(store.startingSession).toBe(false)
  })

  it('internal refreshes from endSession do not call connectWorkspace', async () => {
    mocked.getWorkspace
      .mockResolvedValueOnce({ workspace: fakeWorkspace(), sessions: [fakeSession()] })
      .mockResolvedValueOnce({ workspace: fakeWorkspace(), sessions: [] })
    const store = useWorkspacesStore()
    store.activeWorkspace = fakeWorkspace()
    store.sessions = [fakeSession()]
    store.activeSessionId = 'sess-1'

    await store.endSession('sess-1')

    // open() from navigation would call connectWorkspace; the internal refresh must not
    expect(mocked.connectWorkspace).not.toHaveBeenCalled()
  })

  it('internal refreshes from attachRepository do not call connectWorkspace', async () => {
    mocked.attachRepository.mockResolvedValue()
    mocked.getWorkspace.mockResolvedValue({
      workspace: { ...fakeWorkspace(), repositories: [{ id: 'repo-a', name: 'r', repoUrl: 'u', defaultBranch: 'main', createdAt: '2026-05-20T10:00:00Z', updatedAt: '2026-05-20T10:00:00Z', isPrimary: false, attachedAt: '2026-05-20T10:00:00Z' }] },
      sessions: [],
    })
    const store = useWorkspacesStore()
    store.activeWorkspace = { ...fakeWorkspace(), repositories: [] }

    await store.attachRepository('repo-a')

    expect(mocked.connectWorkspace).not.toHaveBeenCalled()
  })
})
