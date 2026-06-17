import type { AgentSession, Workspace } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStatusesStore } from '../stores/sessionStatuses'
import { useWorkspacesStore } from '../stores/workspaces'

class MockEventSource {
  static instances: MockEventSource[] = []

  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  listeners = new Map<string, Array<(ev: { data: string }) => void>>()

  constructor(
    public url: string,
    public init?: EventSourceInit,
  ) {
    MockEventSource.instances.push(this)
  }

  addEventListener(name: string, handler: (ev: { data: string }) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), handler])
  }

  close(): void {
    this.closed = true
    this.readyState = 2
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  error(): void {
    this.readyState = 0
    this.onerror?.()
  }

  emit(name: string, data = ''): void {
    for (const handler of this.listeners.get(name) ?? []) handler({ data })
  }
}

function latest(): MockEventSource {
  const source = MockEventSource.instances.at(-1)
  if (!source) throw new Error('no MockEventSource created yet')
  return source
}

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
    id: 'sess-1',
    workspaceId: 'ws-1',
    kind: 'CLAUDE',
    gatewayAgentId: 'agent-1',
    status: 'RUNNING',
    idle: false,
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
    ...over,
  }
}

describe('useSessionStatusesStore', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes the active workspace snapshot on connect and reconnect without triggering a runner connect', async () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    const open = vi.spyOn(workspaces, 'open').mockResolvedValue()
    const statuses = useSessionStatusesStore()

    statuses.connect()
    latest().open()
    await statuses.waitForRefresh()
    latest().error() // transient — readyState = 0 (CONNECTING)
    latest().open()
    await statuses.waitForRefresh()

    expect(open).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenCalledWith('ws-1', { connectRunner: false })
    expect(statuses.connectionState).toBe('open')
    expect(statuses.connectionError).toBeNull()
  })

  it('sets reconnecting state while EventSource is auto-retrying after onerror', () => {
    const statuses = useSessionStatusesStore()
    statuses.connect()

    latest().error() // readyState = 0 (CONNECTING) — native reconnect

    expect(statuses.connectionState).toBe('reconnecting')
    expect(statuses.connectionError).toBeNull()
  })

  it('recovers to open state after reconnect completes', async () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    vi.spyOn(workspaces, 'open').mockResolvedValue()
    const statuses = useSessionStatusesStore()

    statuses.connect()
    latest().error()
    expect(statuses.connectionState).toBe('reconnecting')

    latest().open()
    await statuses.waitForRefresh()

    expect(statuses.connectionState).toBe('open')
    expect(statuses.connectionError).toBeNull()
  })

  it('does not open a second stream when connect is called while already connected', () => {
    const statuses = useSessionStatusesStore()
    statuses.connect()
    statuses.connect()

    expect(MockEventSource.instances).toHaveLength(1)
  })

  it('processes immediate keepalive before onopen fires', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession()]
    const statuses = useSessionStatusesStore()
    statuses.connect()

    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T10:07:00Z' }))

    expect(statuses.lastKeepaliveAt).toBe('2026-06-12T10:07:00Z')
    expect(statuses.connectionState).toBe('connecting')
  })

  it('merges newer status deltas into REST sessions and rejects stale events', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession({ status: 'RUNNING', updatedAt: '2026-06-12T10:00:00Z' })]
    const statuses = useSessionStatusesStore()
    statuses.syncRestSessions()

    statuses.applyStatus({ sessionId: 'sess-1', status: 'STOPPED', idle: false, ts: '2026-06-12T10:05:00Z' })
    statuses.applyStatus({ sessionId: 'sess-1', status: 'RUNNING', idle: false, ts: '2026-06-12T10:01:00Z' })

    expect(statuses.mergedSessions).toHaveLength(1)
    expect(statuses.mergedSessions[0]!.status).toBe('STOPPED')
    expect(statuses.lastTsBySessionId['sess-1']).toBe('2026-06-12T10:05:00Z')
  })

  it('preserves REST setup metadata when applying status overlays', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [
      fakeSession({
        currentSetup: { id: 'setup-current', version: 1 },
        pendingSetup: { id: 'setup-next', version: 2 },
        generation: 7,
        epoch: 3,
      }),
    ]
    const statuses = useSessionStatusesStore()
    statuses.syncRestSessions()

    statuses.applyStatus({ sessionId: 'sess-1', status: 'STOPPED', idle: false, ts: '2026-06-12T10:05:00Z' })

    expect(statuses.mergedSessions[0]).toMatchObject({
      status: 'STOPPED',
      currentSetup: { id: 'setup-current', version: 1 },
      pendingSetup: { id: 'setup-next', version: 2 },
      generation: 7,
      epoch: 3,
    })
  })

  it('removes sessions via remove deltas and rejects stale resurrection', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession()]
    const statuses = useSessionStatusesStore()
    statuses.syncRestSessions()

    statuses.applyRemove({ sessionId: 'sess-1', ts: '2026-06-12T10:05:00Z' })
    statuses.applyStatus({ sessionId: 'sess-1', status: 'RUNNING', idle: false, ts: '2026-06-12T10:04:00Z' })

    expect(statuses.mergedSessions).toEqual([])
    expect(statuses.removedAt['sess-1']).toBe('2026-06-12T10:05:00Z')
  })

  it('ignores unknown session ids safely', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession({ id: 'known' })]
    const statuses = useSessionStatusesStore()
    statuses.syncRestSessions()

    statuses.applyStatus({ sessionId: 'unknown', status: 'FAILED', idle: false, ts: '2026-06-12T10:05:00Z' })
    statuses.applyRemove({ sessionId: 'missing', ts: '2026-06-12T10:06:00Z' })

    expect(statuses.mergedSessions.map((session) => session.id)).toEqual(['known'])
    expect(statuses.overlays).toEqual({})
    expect(statuses.removedAt).toEqual({})
  })

  it('counts malformed events and records keepalives without changing sessions', () => {
    const workspaces = useWorkspacesStore()
    workspaces.sessions = [fakeSession()]
    const statuses = useSessionStatusesStore()
    statuses.connect()

    latest().emit('status', 'bad-json')
    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T10:07:00Z' }))

    expect(statuses.malformedEvents).toBe(1)
    expect(statuses.lastKeepaliveAt).toBe('2026-06-12T10:07:00Z')
    expect(statuses.mergedSessions).toHaveLength(1)
  })

  it('closes the stream on teardown and resets connection state', () => {
    const statuses = useSessionStatusesStore()
    statuses.connect()
    const source = latest()

    statuses.disconnect()

    expect(source.closed).toBe(true)
    expect(statuses.connectionState).toBe('idle')
    expect(statuses.connectionError).toBeNull()
  })
})
