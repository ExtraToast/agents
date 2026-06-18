import type { AgentSessionStatus } from '../types'
import type { TokenProvider } from '@/lib/runtimeOrigins'
import { CredentialsModePolicy, UrlBuilder } from '@/lib/runtimeOrigins'

export interface SessionStatusEvent {
  sessionId: string
  status: AgentSessionStatus
  idle: boolean
  ts: string
}

export interface SessionRemoveEvent {
  sessionId: string
  ts: string
}

export interface SessionKeepaliveEvent {
  ts: string | null
}

export interface SessionStatusStreamOptions {
  url?: string
  tokenProvider?: TokenProvider
  onOpen?: () => void
  /** Fired when onerror fires while the browser is still reconnecting (readyState CONNECTING). */
  onReconnecting?: () => void
  /** Fired when onerror fires and the browser has given up reconnecting (readyState CLOSED). */
  onError?: () => void
  onStatus?: (event: SessionStatusEvent) => void
  onRemove?: (event: SessionRemoveEvent) => void
  onKeepalive?: (event: SessionKeepaliveEvent) => void
  onMalformed?: (eventName: 'status' | 'remove' | 'keepalive', data: string) => void
}

export interface SessionStatusStream {
  close: () => void
  readyState: () => number
}

const STATUSES = new Set<AgentSessionStatus>(['STARTING', 'RUNNING', 'STOPPED', 'FAILED'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isValidTs(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseJson(data: string): unknown {
  if (!data) return {}
  return JSON.parse(data)
}

function parseStatus(data: string): SessionStatusEvent | null {
  const parsed = parseJson(data)
  if (!isRecord(parsed)) return null
  if (typeof parsed.sessionId !== 'string') return null
  if (typeof parsed.status !== 'string' || !STATUSES.has(parsed.status as AgentSessionStatus)) return null // eslint-disable-line ts/consistent-type-assertions
  if (typeof parsed.idle !== 'boolean') return null
  if (!isValidTs(parsed.ts)) return null
  return {
    sessionId: parsed.sessionId,
    status: parsed.status as AgentSessionStatus, // eslint-disable-line ts/consistent-type-assertions
    idle: parsed.idle,
    ts: parsed.ts,
  }
}

function parseRemove(data: string): SessionRemoveEvent | null {
  const parsed = parseJson(data)
  if (!isRecord(parsed)) return null
  if (typeof parsed.sessionId !== 'string') return null
  if (!isValidTs(parsed.ts)) return null
  return {
    sessionId: parsed.sessionId,
    ts: parsed.ts,
  }
}

function parseKeepalive(data: string): SessionKeepaliveEvent {
  if (!data) return { ts: null }
  const parsed = parseJson(data)
  return { ts: isRecord(parsed) && typeof parsed.ts === 'string' ? parsed.ts : null }
}

function messageData(ev: Event): string {
  if (!ev || typeof ev !== 'object' || !('data' in ev)) return ''
  const data = (ev as { data: unknown }).data // eslint-disable-line ts/consistent-type-assertions
  return typeof data === 'string' ? data : ''
}

export function openSessionStatusStream(opts: SessionStatusStreamOptions = {}): SessionStatusStream {
  const policy = new CredentialsModePolicy({ tokenProvider: opts.tokenProvider })
  const url = opts.url ?? new UrlBuilder().sessionsEventsUrl()
  if (policy.statusStreamStrategy() === 'fetch-sse') return openFetchSessionStatusStream(url, policy, opts)

  const source = new EventSource(url, { withCredentials: true })

  source.onopen = () => {
    opts.onOpen?.()
  }

  source.onerror = () => {
    if (source.readyState === 0 /* CONNECTING — browser will auto-retry */) {
      opts.onReconnecting?.()
    } else {
      opts.onError?.()
    }
  }

  source.addEventListener('status', (ev) => {
    const data = messageData(ev)
    try {
      const event = parseStatus(data)
      if (event) opts.onStatus?.(event)
      else opts.onMalformed?.('status', data)
    } catch {
      opts.onMalformed?.('status', data)
    }
  })

  source.addEventListener('remove', (ev) => {
    const data = messageData(ev)
    try {
      const event = parseRemove(data)
      if (event) opts.onRemove?.(event)
      else opts.onMalformed?.('remove', data)
    } catch {
      opts.onMalformed?.('remove', data)
    }
  })

  source.addEventListener('keepalive', (ev) => {
    const data = messageData(ev)
    try {
      opts.onKeepalive?.(parseKeepalive(data))
    } catch {
      opts.onMalformed?.('keepalive', data)
    }
  })

  return {
    close() {
      source.close()
    },
    readyState() {
      return source.readyState
    },
  }
}

function openFetchSessionStatusStream(
  url: string,
  policy: CredentialsModePolicy,
  opts: SessionStatusStreamOptions,
): SessionStatusStream {
  const controller = new AbortController()
  let state = 0
  let closed = false

  void (async () => {
    try {
      const init = await policy.streamRequestInit({
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      })
      const response = await fetch(url, init)
      if (!response.ok || !response.body) throw new Error(`session status stream failed (${response.status})`)
      state = 1
      opts.onOpen?.()
      await readSse(response.body, (event, data) => dispatchSessionStatusEvent(event, data, opts))
      state = 2
    } catch {
      if (!closed) {
        state = 2
        opts.onError?.()
      }
    }
  })()

  return {
    close() {
      closed = true
      state = 2
      controller.abort()
    },
    readyState() {
      return state
    },
  }
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  dispatch: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = processSseFrames(buffer, dispatch)
  }

  buffer += decoder.decode()
  if (buffer.trim()) dispatchSseFrame(buffer, dispatch)
}

function processSseFrames(buffer: string, dispatch: (event: string, data: string) => void): string {
  const frames = buffer.split(/\r?\n\r?\n/)
  const partial = frames.pop() ?? ''
  for (const frame of frames) dispatchSseFrame(frame, dispatch)
  return partial
}

function dispatchSseFrame(frame: string, dispatch: (event: string, data: string) => void): void {
  const lines = frame.split(/\r?\n/)
  const event = lines.find((line) => line.startsWith('event:'))?.slice('event:'.length).trim()
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n')
  if (event) dispatch(event, data)
}

function dispatchSessionStatusEvent(event: string, data: string, opts: SessionStatusStreamOptions): void {
  if (event === 'status') {
    try {
      const parsed = parseStatus(data)
      if (parsed) opts.onStatus?.(parsed)
      else opts.onMalformed?.('status', data)
    } catch {
      opts.onMalformed?.('status', data)
    }
  } else if (event === 'remove') {
    try {
      const parsed = parseRemove(data)
      if (parsed) opts.onRemove?.(parsed)
      else opts.onMalformed?.('remove', data)
    } catch {
      opts.onMalformed?.('remove', data)
    }
  } else if (event === 'keepalive') {
    try {
      opts.onKeepalive?.(parseKeepalive(data))
    } catch {
      opts.onMalformed?.('keepalive', data)
    }
  }
}
