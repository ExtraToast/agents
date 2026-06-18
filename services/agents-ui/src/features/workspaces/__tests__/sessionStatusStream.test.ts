import type { SessionStatusStream } from '../services/sessionStatusStream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openSessionStatusStream } from '../services/sessionStatusStream'

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

  /** Simulates a transient connection drop — browser sets readyState back to CONNECTING and will retry. */
  error(): void {
    this.readyState = 0
    this.onerror?.()
  }

  /** Simulates a permanent failure — browser has given up and sets readyState to CLOSED. */
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

describe('sessionStatusStream', () => {
  let stream: SessionStatusStream | null = null

  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    stream?.close()
    stream = null
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('opens the hidden stream with credentials and no polling fallback', () => {
    stream = openSessionStatusStream()
    expect(MockEventSource.instances).toHaveLength(1)
    expect(latest().url).toBe('/api/v1/sessions/events')
    expect(latest().init).toEqual({ withCredentials: true })
  })

  it('uses configured absolute origins with bearer fetch-SSE and no EventSource host rewrite', async () => {
    vi.stubEnv('VITE_AGENTS_API_ORIGIN', 'https://api.example.com')
    const open = vi.fn()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(new ReadableStream<Uint8Array>({ start: (controller) => controller.close() }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    stream = openSessionStatusStream({
      tokenProvider: { getAccessToken: () => 'token' },
      onOpen: open,
    })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    expect(MockEventSource.instances).toHaveLength(0)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/api/v1/sessions/events')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer token')
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1))
  })

  it('calls onOpen when connection is established', () => {
    const open = vi.fn()
    stream = openSessionStatusStream({ onOpen: open })

    latest().open()

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('calls onReconnecting on transient onerror when readyState is CONNECTING', () => {
    const reconnecting = vi.fn()
    const error = vi.fn()
    stream = openSessionStatusStream({ onReconnecting: reconnecting, onError: error })

    latest().error() // readyState = 0 (CONNECTING) — native reconnect pending

    expect(reconnecting).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it('calls onError on permanent disconnect when readyState is CLOSED', () => {
    const reconnecting = vi.fn()
    const error = vi.fn()
    stream = openSessionStatusStream({ onReconnecting: reconnecting, onError: error })

    latest().permanentError() // readyState = 2 (CLOSED) — browser gave up

    expect(error).toHaveBeenCalledTimes(1)
    expect(reconnecting).not.toHaveBeenCalled()
  })

  it('processes keepalive event immediately without waiting for onopen', () => {
    const keepalive = vi.fn()
    stream = openSessionStatusStream({ onKeepalive: keepalive })

    // Emit before open() fires — server may send keepalive as first frame.
    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T12:00:00Z' }))

    expect(keepalive).toHaveBeenCalledWith({ ts: '2026-06-12T12:00:00Z' })
  })

  it('parses named status, remove, and keepalive events', () => {
    const status = vi.fn()
    const remove = vi.fn()
    const keepalive = vi.fn()
    stream = openSessionStatusStream({ onStatus: status, onRemove: remove, onKeepalive: keepalive })

    latest().emit(
      'status',
      JSON.stringify({ sessionId: 'sess-1', status: 'RUNNING', idle: false, ts: '2026-06-12T12:00:00Z' }),
    )
    latest().emit('remove', JSON.stringify({ sessionId: 'sess-1', ts: '2026-06-12T12:01:00Z' }))
    latest().emit('keepalive', JSON.stringify({ ts: '2026-06-12T12:02:00Z' }))

    expect(status).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      status: 'RUNNING',
      idle: false,
      ts: '2026-06-12T12:00:00Z',
    })
    expect(remove).toHaveBeenCalledWith({ sessionId: 'sess-1', ts: '2026-06-12T12:01:00Z' })
    expect(keepalive).toHaveBeenCalledWith({ ts: '2026-06-12T12:02:00Z' })
  })

  it('does not add setup metadata from status events', () => {
    const status = vi.fn()
    stream = openSessionStatusStream({ onStatus: status })

    latest().emit(
      'status',
      JSON.stringify({
        sessionId: 'sess-1',
        status: 'RUNNING',
        idle: false,
        ts: '2026-06-12T12:00:00Z',
        currentSetup: { id: 'setup-current', version: 1 },
      }),
    )

    expect(status).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      status: 'RUNNING',
      idle: false,
      ts: '2026-06-12T12:00:00Z',
    })
  })

  it('routes malformed named events without throwing', () => {
    const status = vi.fn()
    const malformed = vi.fn()
    stream = openSessionStatusStream({ onStatus: status, onMalformed: malformed })

    latest().emit('status', 'not-json')
    latest().emit('status', JSON.stringify({ sessionId: 'sess-1', status: 'BROKEN', idle: false, ts: 'x' }))

    expect(status).not.toHaveBeenCalled()
    expect(malformed).toHaveBeenCalledTimes(2)
    expect(malformed).toHaveBeenNthCalledWith(1, 'status', 'not-json')
  })

  it('closes the EventSource on teardown', () => {
    stream = openSessionStatusStream()
    const source = latest()

    stream.close()

    expect(source.closed).toBe(true)
    expect(stream.readyState()).toBe(2)
  })
})
