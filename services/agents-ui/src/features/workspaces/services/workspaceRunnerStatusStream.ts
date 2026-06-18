import type { RunnerReadiness } from '../types'
import type { TokenProvider } from '@/lib/runtimeOrigins'
import { CredentialsModePolicy, UrlBuilder } from '@/lib/runtimeOrigins'

export interface RunnerReadinessEvent {
  workspaceId: string
  readiness: RunnerReadiness
  ts: string
}

export interface RunnerKeepaliveEvent {
  ts: string | null
}

export interface WorkspaceRunnerStatusStreamOptions {
  tokenProvider?: TokenProvider
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
  const policy = new CredentialsModePolicy({ tokenProvider: opts.tokenProvider })
  const url = new UrlBuilder().workspaceRunnerEventsUrl(workspaceId)
  if (policy.statusStreamStrategy() === 'fetch-sse') return openFetchWorkspaceRunnerStatusStream(url, policy, opts)

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

function openFetchWorkspaceRunnerStatusStream(
  url: string,
  policy: CredentialsModePolicy,
  opts: WorkspaceRunnerStatusStreamOptions,
): WorkspaceRunnerStatusStream {
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
      if (!response.ok || !response.body) throw new Error(`workspace runner stream failed (${response.status})`)
      state = 1
      opts.onOpen?.()
      await readSse(response.body, (event, data) => dispatchWorkspaceRunnerEvent(event, data, opts))
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

function dispatchWorkspaceRunnerEvent(event: string, data: string, opts: WorkspaceRunnerStatusStreamOptions): void {
  if (event === 'runner-readiness') {
    try {
      const parsed = parseRunnerReadiness(data)
      if (parsed) opts.onRunnerReadiness?.(parsed)
      else opts.onMalformed?.('runner-readiness', data)
    } catch {
      opts.onMalformed?.('runner-readiness', data)
    }
  } else if (event === 'keepalive') {
    try {
      opts.onKeepalive?.(parseKeepalive(data))
    } catch {
      opts.onMalformed?.('keepalive', data)
    }
  }
}
