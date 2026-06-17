import type { WorkspaceRunnerStatusStream } from '../services/workspaceRunnerStatusStream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openWorkspaceRunnerStatusStream } from '../services/workspaceRunnerStatusStream'

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

  /** Transient error — browser sets readyState CONNECTING and will auto-retry. */
  error(): void {
    this.readyState = 0
    this.onerror?.()
  }

  /** Permanent error — browser has given up, sets readyState CLOSED. */
  permanentError(): void {
    this.readyState = 2
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

describe('workspaceRunnerStatusStream', () => {
  let stream: WorkspaceRunnerStatusStream | null = null

  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    stream?.close()
    stream = null
    vi.unstubAllGlobals()
  })

  it('opens a workspace-scoped SSE stream with credentials', () => {
    stream = openWorkspaceRunnerStatusStream('ws-1')
    expect(MockEventSource.instances).toHaveLength(1)
    expect(latest().url).toBe('/api/v1/workspaces/ws-1/runner-events')
    expect(latest().init).toEqual({ withCredentials: true })
  })

  it('calls onOpen when connection is established', () => {
    const open = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onOpen: open })

    latest().open()

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('calls onReconnecting on transient onerror when readyState is CONNECTING', () => {
    const reconnecting = vi.fn()
    const error = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onReconnecting: reconnecting, onError: error })

    latest().error() // readyState = 0 (CONNECTING)

    expect(reconnecting).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it('calls onError on permanent disconnect when readyState is CLOSED', () => {
    const reconnecting = vi.fn()
    const error = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onReconnecting: reconnecting, onError: error })

    latest().permanentError() // readyState = 2 (CLOSED)

    expect(error).toHaveBeenCalledTimes(1)
    expect(reconnecting).not.toHaveBeenCalled()
  })

  it('parses runner-readiness events', () => {
    const onReadiness = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onRunnerReadiness: onReadiness })

    latest().emit(
      'runner-readiness',
      JSON.stringify({ workspaceId: 'ws-1', readiness: 'ready', ts: '2026-06-12T12:00:00Z' }),
    )

    expect(onReadiness).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      readiness: 'ready',
      ts: '2026-06-12T12:00:00Z',
    })
  })

  it('parses all valid readiness values', () => {
    const onReadiness = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onRunnerReadiness: onReadiness })

    for (const readiness of ['unknown', 'booting', 'ready', 'failed']) {
      latest().emit(
        'runner-readiness',
        JSON.stringify({ workspaceId: 'ws-1', readiness, ts: '2026-06-12T12:00:00Z' }),
      )
    }

    expect(onReadiness).toHaveBeenCalledTimes(4)
  })

  it('processes keepalive events immediately without waiting for onopen', () => {
    const keepalive = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onKeepalive: keepalive })

    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T12:00:00Z' }))

    expect(keepalive).toHaveBeenCalledWith({ ts: '2026-06-12T12:00:00Z' })
  })

  it('calls onMalformed for invalid runner-readiness payloads', () => {
    const onReadiness = vi.fn()
    const onMalformed = vi.fn()
    stream = openWorkspaceRunnerStatusStream('ws-1', { onRunnerReadiness: onReadiness, onMalformed })

    latest().emit('runner-readiness', 'not-json')
    latest().emit('runner-readiness', JSON.stringify({ workspaceId: 'ws-1', readiness: 'UNKNOWN_VALUE', ts: 'bad-ts' }))

    expect(onReadiness).not.toHaveBeenCalled()
    expect(onMalformed).toHaveBeenCalledTimes(2)
    expect(onMalformed).toHaveBeenNthCalledWith(1, 'runner-readiness', 'not-json')
  })

  it('closes the EventSource on teardown', () => {
    stream = openWorkspaceRunnerStatusStream('ws-1')
    const source = latest()

    stream.close()

    expect(source.closed).toBe(true)
    expect(stream.readyState()).toBe(2)
  })
})
