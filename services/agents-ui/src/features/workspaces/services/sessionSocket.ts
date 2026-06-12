/**
 * Thin wrapper around the browser WebSocket for the
 * `/api/v1/ws/sessions/{id}/attach` endpoint. The agents-api
 * handler speaks these envelope shapes:
 *
 *   inbound  -> `{ "input": "...", "enter": true }`
 *   inbound  -> `{ "resize": { "cols": <int>, "rows": <int> } }`
 *   outbound -> `{ "epoch": 1, "snapshot": true }`
 *   outbound -> `{ "output": "...bytes-as-utf8...", "off": 123 }`
 *   outbound -> `{ "cursor": { "off": 123 } }`
 *
 * The socket self-heals. A backgrounded tab's WS is idle-closed by the
 * proxy/container after a while; without reconnection the terminal
 * silently rots — output stops and `send` drops keystrokes because the
 * socket is no longer OPEN. So an unexpected close schedules a
 * capped-backoff reconnect, keystrokes typed across the gap are queued
 * and flushed on reopen. Reconnects resume from the last acknowledged
 * epoch/offset when the gateway has provided both values; otherwise the
 * query is omitted so the gateway returns a snapshot.
 *
 * Reconnection is gated by [setReconnect] so an inactive tab does not
 * hold its runner alive against the idle reaper: only the visible
 * terminal keeps its socket warm; a hidden one is allowed to lapse and
 * reconnects when it is shown again. The active socket also sends a
 * small application-level heartbeat because browsers cannot emit WS
 * ping frames and quiet terminals otherwise look idle to proxies.
 */
export interface SessionSocketOptions {
  sessionId: string
  onOutput: (text: string) => void
  onControl?: (epoch: number, snapshot: boolean) => void
  /** Fired when a *reconnect* (not the first connect) opens. */
  onReopen?: () => void
  onClose?: (code: number, reason: string) => void
}

export interface SessionSocket {
  send: (input: string, enter?: boolean) => void
  sendKey: (key: string) => void
  sendResize: (cols: number, rows: number) => void
  /** Enable/disable auto-reconnect (drive from tab visibility). */
  setReconnect: (enabled: boolean) => void
  /** Reconnect immediately if the socket is not already live. */
  reconnectNow: () => void
  close: () => void
  readyState: () => number
}

const MAX_BACKOFF_MS = 10_000
const BASE_BACKOFF_MS = 500
const MAX_QUEUED_FRAMES = 200
const HEARTBEAT_INTERVAL_MS = 30_000

export function attachSessionSocket(opts: SessionSocketOptions): SessionSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // The terminal WS uses the dedicated `agents-ws` host, which a
  // co-located Enschede agents-api replica answers (split-DNS keeps
  // on-site keystrokes local instead of detouring through Frankfurt).
  // Other hosts (e.g. localhost in dev) are left unchanged.
  const wsHost = window.location.host.replace(/^agents\./, 'agents-ws.')
  const baseUrl = `${proto}//${wsHost}/api/v1/ws/sessions/${opts.sessionId}/attach`

  let ws: WebSocket | null = null
  let closedByCaller = false
  let reconnectEnabled = true
  let attempts = 0
  let everOpened = false
  let lastEpoch: number | null = null
  let lastOff: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  const queue: string[] = []

  function connectUrl(): string {
    if (lastEpoch === null || lastOff === null) return baseUrl
    const params = new URLSearchParams({ epoch: String(lastEpoch), offset: String(lastOff) })
    return `${baseUrl}?${params}`
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function sendHeartbeat(): void {
    if (reconnectEnabled && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ heartbeat: true }))
    }
  }

  function startHeartbeat(): void {
    if (!reconnectEnabled || heartbeatTimer !== null || ws?.readyState !== WebSocket.OPEN) return
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
  }

  function flushQueue(): void {
    while (queue.length > 0 && ws?.readyState === WebSocket.OPEN) {
      const frame = queue.shift()
      if (frame !== undefined) ws.send(frame)
    }
  }

  function enqueue(frame: string): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(frame)
    } else if (queue.length < MAX_QUEUED_FRAMES) {
      queue.push(frame)
    }
  }

  function scheduleReconnect(): void {
    if (!reconnectEnabled || closedByCaller) return
    clearTimer()
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS)
    attempts += 1
    timer = setTimeout(connect, delay)
  }

  function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
  }

  function updateCursor(epoch: unknown, off: unknown): void {
    if (isNonNegativeNumber(epoch)) {
      if (lastEpoch !== epoch) lastOff = null
      lastEpoch = epoch
    }
    if (isNonNegativeNumber(off) && lastEpoch !== null) lastOff = off
  }

  function handleMessage(data: string): void {
    try {
      const payload: unknown = JSON.parse(data)
      if (!payload || typeof payload !== 'object') return
      const frame = payload as Record<string, unknown> // eslint-disable-line ts/consistent-type-assertions

      if (isNonNegativeNumber(frame.epoch) && typeof frame.snapshot === 'boolean') {
        if (lastEpoch !== frame.epoch || frame.snapshot) lastOff = null
        lastEpoch = frame.epoch
        opts.onControl?.(frame.epoch, frame.snapshot)
      }

      if ('cursor' in frame && frame.cursor && typeof frame.cursor === 'object') {
        const cursor = frame.cursor as Record<string, unknown> // eslint-disable-line ts/consistent-type-assertions
        updateCursor(cursor.epoch, cursor.off ?? cursor.offset)
      }

      if ('output' in frame) {
        const output = frame.output
        if (typeof output === 'string') {
          opts.onOutput(output)
          updateCursor(frame.epoch, frame.off ?? frame.offset)
        }
      }
    } catch {
      // ignore non-JSON frames
    }
  }

  function connect(): void {
    clearTimer()
    if (closedByCaller) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    ws = new WebSocket(connectUrl())
    ws.onopen = () => {
      attempts = 0
      if (everOpened) opts.onReopen?.()
      everOpened = true
      flushQueue()
      startHeartbeat()
    }
    ws.onmessage = (ev) => handleMessage(ev.data)
    ws.onclose = (ev) => {
      clearHeartbeat()
      opts.onClose?.(ev.code, ev.reason)
      scheduleReconnect()
    }
  }

  connect()

  return {
    send(input, enter = true) {
      enqueue(JSON.stringify({ input, enter }))
    },
    sendKey(key) {
      enqueue(JSON.stringify({ input: key, enter: false }))
    },
    sendResize(cols, rows) {
      enqueue(JSON.stringify({ resize: { cols, rows } }))
    },
    setReconnect(enabled) {
      reconnectEnabled = enabled
      if (enabled) {
        startHeartbeat()
      } else {
        clearTimer()
        clearHeartbeat()
      }
    },
    reconnectNow() {
      attempts = 0
      const state = ws?.readyState
      if (state === undefined || state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
        connect()
      }
    },
    close() {
      closedByCaller = true
      clearTimer()
      clearHeartbeat()
      ws?.close()
    },
    readyState() {
      return ws?.readyState ?? WebSocket.CLOSED
    },
  }
}
