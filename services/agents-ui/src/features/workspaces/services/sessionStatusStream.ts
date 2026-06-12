import type { AgentSessionStatus } from '../types'

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
  onOpen?: () => void
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

const DEFAULT_URL = '/api/v1/sessions/events'
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
  const source = new EventSource(opts.url ?? DEFAULT_URL, { withCredentials: true })

  source.onopen = () => {
    opts.onOpen?.()
  }

  source.onerror = () => {
    opts.onError?.()
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
