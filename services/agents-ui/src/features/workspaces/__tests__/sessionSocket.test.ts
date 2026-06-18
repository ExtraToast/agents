import type { SessionSocket } from '../services/sessionSocket'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachSessionSocket } from '../services/sessionSocket'

// Minimal driveable WebSocket double. The constants must live as
// statics because sessionSocket reads WebSocket.OPEN / CONNECTING / etc.
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number; reason: string }) => void) | null = null

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: 'client' })
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  serverClose(code = 1006): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason: 'idle' })
  }

  message(data: string): void {
    this.onmessage?.({ data })
  }
}

function latest(): MockWebSocket {
  const ws = MockWebSocket.instances.at(-1)
  if (!ws) throw new Error('no MockWebSocket created yet')
  return ws
}

describe('sessionSocket', () => {
  let sock: SessionSocket | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    sock?.close()
    sock = null
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('opens one socket on attach', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(latest().url).toContain('/api/v1/ws/sessions/s1/attach')
    expect(latest().url).not.toContain('?')
  })

  it('uses a configured websocket origin as-is without the legacy host rewrite', () => {
    vi.stubEnv('VITE_AGENTS_WS_ORIGIN', 'wss://agents.example.com')

    sock = attachSessionSocket({ sessionId: 's1', attachToken: 'attach-token', onOutput: () => {} })

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(latest().url).toBe('wss://agents.example.com/api/v1/ws/sessions/s1/attach?attach-token=attach-token')
  })

  it('queues input typed before open and flushes it once open', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    sock.send('hi', false)
    expect(latest().sent).toHaveLength(0) // still CONNECTING
    latest().open()
    expect(latest().sent).toEqual([JSON.stringify({ input: 'hi', enter: false })])
  })

  it('parses {output} frames to onOutput and ignores other frames', () => {
    const out: string[] = []
    sock = attachSessionSocket({ sessionId: 's1', onOutput: (t) => out.push(t) })
    latest().open()
    latest().message(JSON.stringify({ output: 'hello' }))
    latest().message(JSON.stringify({ other: 'x' }))
    latest().message('not-json')
    expect(out).toEqual(['hello'])
  })

  it('fires legacy control callbacks and resumes reconnects from the last epoch offset', () => {
    const control = vi.fn()
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {}, onControl: control })
    latest().open()
    latest().message(JSON.stringify({ epoch: 7, snapshot: true }))
    latest().message(JSON.stringify({ output: 'hello', off: 12 }))

    expect(control).toHaveBeenCalledWith(7, true)

    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(MockWebSocket.instances).toHaveLength(2)
    expect(latest().url).toContain('/api/v1/ws/sessions/s1/attach?')
    expect(latest().url).toContain('epoch=7')
    expect(latest().url).toContain('offset=12')
  })

  it('resumes same-epoch durable reconnects without clearing the terminal', () => {
    const control = vi.fn()
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {}, onControl: control })
    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 3 }))
    latest().message(JSON.stringify({ cursor: 4 }))
    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(latest().url).toContain('epoch=3')
    expect(latest().url).toContain('offset=4')

    latest().open()
    latest().message(JSON.stringify({ control: 'RESUME', epoch: 3 }))
    latest().message(JSON.stringify({ output: 'tail', off: 8 }))
    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(control).toHaveBeenNthCalledWith(1, 3, true)
    expect(control).toHaveBeenNthCalledWith(2, 3, false)
    expect(latest().url).toContain('epoch=3')
    expect(latest().url).toContain('offset=8')
  })

  it('clears only for durable snapshot reset or epoch transition', () => {
    const control = vi.fn()
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {}, onControl: control })
    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 1 }))
    latest().message(JSON.stringify({ cursor: 10 }))
    latest().message(JSON.stringify({ control: 'RESUME', epoch: 1 }))
    latest().message(JSON.stringify({ control: 'RESUME', epoch: 2 }))
    latest().message(JSON.stringify({ reset: true }))

    expect(control.mock.calls).toEqual([
      [1, true],
      [1, false],
      [2, true],
      [2, true],
    ])

    latest().serverClose()
    vi.advanceTimersByTime(600)
    expect(latest().url).not.toContain('?')
  })

  it('updates the reconnect cursor from numeric and legacy object cursor frames', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    latest().message(JSON.stringify({ epoch: 3, snapshot: true }))
    latest().message(JSON.stringify({ cursor: 7 }))
    latest().message(JSON.stringify({ cursor: { off: 9 } }))
    latest().message(JSON.stringify({ cursor: {} }))

    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(latest().url).toContain('epoch=3')
    expect(latest().url).toContain('offset=9')
  })

  it('advances stale reconnect offsets when a trim frame moves the transcript window', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 5 }))
    latest().message(JSON.stringify({ cursor: 2 }))
    latest().message(JSON.stringify({ trim: 6 }))

    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(latest().url).toContain('epoch=5')
    expect(latest().url).toContain('offset=6')
  })

  it('exposes replay complete and records its cursor for the next reconnect', () => {
    const replayComplete = vi.fn()
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {}, onReplayComplete: replayComplete })
    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 4 }))
    latest().message(JSON.stringify({ output: 'abc', off: 3 }))
    latest().message(JSON.stringify({ control: 'REPLAY_COMPLETE', cursor: 3 }))

    expect(replayComplete).toHaveBeenCalledWith(3)

    latest().serverClose()
    vi.advanceTimersByTime(600)
    expect(latest().url).toContain('epoch=4')
    expect(latest().url).toContain('offset=3')
  })

  it('omits the reconnect cursor after a stale epoch snapshot until a new offset arrives', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    latest().message(JSON.stringify({ epoch: 1, snapshot: true }))
    latest().message(JSON.stringify({ output: 'old', off: 10 }))
    latest().serverClose()
    vi.advanceTimersByTime(600)

    latest().open()
    latest().message(JSON.stringify({ epoch: 2, snapshot: true }))
    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(latest().url).not.toContain('?')

    latest().open()
    latest().message(JSON.stringify({ output: 'new', off: 4 }))
    latest().serverClose()
    vi.advanceTimersByTime(600)

    expect(latest().url).toContain('epoch=2')
    expect(latest().url).toContain('offset=4')
  })

  it('reconnects after an unexpected close and fires onReopen on the new open', () => {
    const reopened = vi.fn()
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {}, onReopen: reopened })
    latest().open()
    expect(MockWebSocket.instances).toHaveLength(1)

    latest().serverClose() // idle drop
    vi.advanceTimersByTime(600) // past first backoff
    expect(MockWebSocket.instances).toHaveLength(2)

    expect(reopened).not.toHaveBeenCalled()
    latest().open() // reconnect established
    expect(reopened).toHaveBeenCalledTimes(1)
  })

  it('preserves queued input across a reconnect snapshot', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 1 }))
    latest().message(JSON.stringify({ cursor: 0 }))
    latest().serverClose()
    sock.send('queued', false)
    vi.advanceTimersByTime(600)

    expect(latest().sent).toEqual([])

    latest().open()
    latest().message(JSON.stringify({ control: 'SNAPSHOT', epoch: 1 }))
    latest().message(JSON.stringify({ reset: true }))
    expect(latest().sent).toEqual([JSON.stringify({ input: 'queued', enter: false })])
  })

  it('does not reconnect while reconnect is disabled', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    sock.setReconnect(false)
    latest().serverClose()
    vi.advanceTimersByTime(60_000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('reconnectNow reopens a lapsed socket immediately', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    sock.setReconnect(false)
    latest().serverClose()
    expect(MockWebSocket.instances).toHaveLength(1)

    sock.setReconnect(true)
    sock.reconnectNow()
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('keeps an active socket warm with heartbeats', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()

    vi.advanceTimersByTime(29_999)
    expect(latest().sent).toEqual([])

    vi.advanceTimersByTime(1)
    expect(latest().sent).toEqual([JSON.stringify({ heartbeat: true })])
  })

  it('stops heartbeats while reconnect is disabled', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    sock.setReconnect(false)

    vi.advanceTimersByTime(60_000)
    expect(latest().sent).toEqual([])
  })

  it('never reconnects after a deliberate close', () => {
    sock = attachSessionSocket({ sessionId: 's1', onOutput: () => {} })
    latest().open()
    sock.close()
    vi.advanceTimersByTime(60_000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })
})
