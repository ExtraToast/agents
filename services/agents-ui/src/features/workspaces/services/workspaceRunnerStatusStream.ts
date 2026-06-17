import type { RunnerReadiness } from '../types'

export interface RunnerReadinessEvent {
  workspaceId: string
  readiness: RunnerReadiness
  ts: string
}

export interface RunnerKeepaliveEvent {
  ts: string | null
}

export interface WorkspaceRunnerStatusStreamOptions {
  onOpen?: () => void
  /** Fired when onerror fires while the browser is still reconnecting (readyState CONNECTING). */
  onReconnecting?: () => void
  /** Fired when onerror fires and the browser has given up reconnecting (readyState CLOSED). */
  onError?: () => void
  onRunnerReadiness?: (event: RunnerReadinessEvent) => void
  onKeepalive?: (event: RunnerKeepaliveEvent) => void
  onMalformed?: (eventName: 'runner-readiness' | 'keepalive', data: string) => void
}

export interface WorkspaceRunnerStatusStream {
  close: () => void
  readyState: () => number
}

const READINESS_VALUES = new Set<RunnerReadiness>(['unknown', 'booting', 'ready', 'failed'])

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

function parseRunnerReadiness(data: string): RunnerReadinessEvent | null {
  const parsed = parseJson(data)
  if (!isRecord(parsed)) return null
  if (typeof parsed.workspaceId !== 'string') return null
  if (typeof parsed.readiness !== 'string' || !READINESS_VALUES.has(parsed.readiness as RunnerReadiness)) return null // eslint-disable-line ts/consistent-type-assertions
  if (!isValidTs(parsed.ts)) return null
  return {
    workspaceId: parsed.workspaceId,
    readiness: parsed.readiness as RunnerReadiness, // eslint-disable-line ts/consistent-type-assertions
    ts: parsed.ts,
  }
}

function parseKeepalive(data: string): RunnerKeepaliveEvent {
  if (!data) return { ts: null }
  const parsed = parseJson(data)
  return { ts: isRecord(parsed) && typeof parsed.ts === 'string' ? parsed.ts : null }
}

function messageData(ev: Event): string {
  if (!ev || typeof ev !== 'object' || !('data' in ev)) return ''
  const data = (ev as { data: unknown }).data // eslint-disable-line ts/consistent-type-assertions
  return typeof data === 'string' ? data : ''
}

export function openWorkspaceRunnerStatusStream(
  workspaceId: string,
  opts: WorkspaceRunnerStatusStreamOptions = {},
): WorkspaceRunnerStatusStream {
  const url = `/api/v1/workspaces/${workspaceId}/runner-events`
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

  source.addEventListener('runner-readiness', (ev) => {
    const data = messageData(ev)
    try {
      const event = parseRunnerReadiness(data)
      if (event) opts.onRunnerReadiness?.(event)
      else opts.onMalformed?.('runner-readiness', data)
    } catch {
      opts.onMalformed?.('runner-readiness', data)
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
