import type { Workspace } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceRunnerStatusesStore } from '../stores/workspaceRunnerStatuses'
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

describe('useWorkspaceRunnerStatusesStore', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens workspace-scoped SSE stream on connect', () => {
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')

    expect(MockEventSource.instances).toHaveLength(1)
    expect(latest().url).toBe('/api/v1/workspaces/ws-1/runner-events')
    expect(store.connectionState).toBe('connecting')
    expect(store.currentWorkspaceId).toBe('ws-1')
  })

  it('does not open a second stream when connect is called for the same workspace', () => {
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')
    store.connect('ws-1')

    expect(MockEventSource.instances).toHaveLength(1)
  })

  it('replaces stream when connect is called for a different workspace', () => {
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')
    const first = latest()

    store.connect('ws-2')

    expect(first.closed).toBe(true)
    expect(MockEventSource.instances).toHaveLength(2)
    expect(store.currentWorkspaceId).toBe('ws-2')
  })

  it('sets open state and refreshes snapshot on SSE open', async () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    const open = vi.spyOn(workspaces, 'open').mockResolvedValue()
    const store = useWorkspaceRunnerStatusesStore()

    store.connect('ws-1')
    latest().open()
    await store.waitForRefresh()

    expect(store.connectionState).toBe('open')
    expect(store.connectionError).toBeNull()
    expect(open).toHaveBeenCalledWith('ws-1', { connectRunner: false })
  })

  it('sets reconnecting state on transient onerror and recovers on reopen', async () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    vi.spyOn(workspaces, 'open').mockResolvedValue()
    const store = useWorkspaceRunnerStatusesStore()

    store.connect('ws-1')
    latest().error() // readyState = 0 — transient

    expect(store.connectionState).toBe('reconnecting')
    expect(store.connectionError).toBeNull()

    latest().open()
    await store.waitForRefresh()

    expect(store.connectionState).toBe('open')
  })

  it('snapshot refresh on SSE reopen uses connectRunner:false to avoid connect loops', async () => {
    const workspaces = useWorkspacesStore()
    workspaces.activeWorkspace = fakeWorkspace()
    const open = vi.spyOn(workspaces, 'open').mockResolvedValue()
    const store = useWorkspaceRunnerStatusesStore()

    store.connect('ws-1')
    latest().error()
    latest().open()
    await store.waitForRefresh()

    for (const call of open.mock.calls) {
      expect(call[1]).toMatchObject({ connectRunner: false })
    }
  })

  it('updates workspaces.runnerReadiness when runner-readiness event is received', () => {
    const workspaces = useWorkspacesStore()
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')

    latest().emit(
      'runner-readiness',
      JSON.stringify({ workspaceId: 'ws-1', readiness: 'ready', ts: '2026-06-12T12:00:00Z' }),
    )

    expect(workspaces.runnerReadiness).toBe('ready')
  })

  it('ignores runner-readiness events for a different workspace', () => {
    const workspaces = useWorkspacesStore()
    workspaces.runnerReadiness = 'unknown'
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')

    latest().emit(
      'runner-readiness',
      JSON.stringify({ workspaceId: 'ws-2', readiness: 'ready', ts: '2026-06-12T12:00:00Z' }),
    )

    expect(workspaces.runnerReadiness).toBe('unknown')
  })

  it('processes immediate keepalive before onopen fires', () => {
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')

    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T10:00:00Z' }))

    expect(store.lastKeepaliveAt).toBe('2026-06-12T10:00:00Z')
    expect(store.connectionState).toBe('connecting')
  })

  it('closes the stream on disconnect and resets state', () => {
    const store = useWorkspaceRunnerStatusesStore()
    store.connect('ws-1')
    const source = latest()

    store.disconnect()

    expect(source.closed).toBe(true)
    expect(store.connectionState).toBe('idle')
    expect(store.connectionError).toBeNull()
    expect(store.currentWorkspaceId).toBeNull()
  })
})
