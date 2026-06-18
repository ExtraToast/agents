export type HttpOriginScheme = 'http:' | 'https:'
export type WsOriginScheme = 'ws:' | 'wss:'
export type CredentialsMode = 'web-cookie' | 'native-bearer'
export type StatusStreamStrategy = 'eventsource' | 'fetch-sse'

export interface TokenProvider {
  getAccessToken: () => Promise<string | null> | string | null
}

export interface RuntimeOriginEnv {
  VITE_AUTH_URL?: string | undefined
  VITE_AUTH_ORIGIN?: string | undefined
  VITE_AGENTS_API_ORIGIN?: string | undefined
  VITE_AGENTS_WS_ORIGIN?: string | undefined
}

export interface SessionAttachUrlOptions {
  sessionId: string
  attachToken?: string | null | undefined
  epoch?: number | null | undefined
  offset?: number | null | undefined
}

export interface CredentialsModePolicyOptions {
  mode?: CredentialsMode | undefined
  origins?: RuntimeOrigins | undefined
  tokenProvider?: TokenProvider | undefined
  csrfTokenSource?: (() => string | null) | undefined
}

export const nullTokenProvider: TokenProvider = {
  getAccessToken: () => null,
}

const API_PREFIX = '/api/v1'
const DEFAULT_AUTH_ORIGIN = 'http://localhost:5174'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

function currentEnv(): RuntimeOriginEnv {
  return import.meta.env
}

function valueOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseHttpOrigin(value: string, envName = 'origin'): string {
  return parseAbsoluteOrigin(value, ['http:', 'https:'], envName)
}

export function parseWsOrigin(value: string, envName = 'origin'): string {
  return parseAbsoluteOrigin(value, ['ws:', 'wss:'], envName)
}

function parseAbsoluteOrigin(
  value: string,
  schemes: readonly string[],
  envName: string,
): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${envName} must be an absolute origin with scheme and host`)
  }

  if (!schemes.includes(url.protocol)) {
    throw new Error(`${envName} must use ${schemes.map((scheme) => scheme.slice(0, -1)).join(' or ')}`)
  }
  if (!url.hostname) {
    throw new Error(`${envName} must include a host`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${envName} must be an origin only, without path, query, or hash`)
  }

  return url.origin
}

export class RuntimeOrigins {
  readonly authOrigin: string
  readonly agentsApiOrigin: string | null
  readonly agentsWsOrigin: string | null

  constructor(env: RuntimeOriginEnv = currentEnv()) {
    const authOrigin = valueOrUndefined(env.VITE_AUTH_ORIGIN)
    const authUrl = valueOrUndefined(env.VITE_AUTH_URL)
    const agentsApiOrigin = valueOrUndefined(env.VITE_AGENTS_API_ORIGIN)
    const agentsWsOrigin = valueOrUndefined(env.VITE_AGENTS_WS_ORIGIN)

    this.authOrigin = parseHttpOrigin(
      authOrigin ?? authUrl ?? DEFAULT_AUTH_ORIGIN,
      authOrigin ? 'VITE_AUTH_ORIGIN' : 'VITE_AUTH_URL',
    )
    this.agentsApiOrigin = agentsApiOrigin ? parseHttpOrigin(agentsApiOrigin, 'VITE_AGENTS_API_ORIGIN') : null
    this.agentsWsOrigin = agentsWsOrigin ? parseWsOrigin(agentsWsOrigin, 'VITE_AGENTS_WS_ORIGIN') : null
  }

  get hasConfiguredAgentsApiOrigin(): boolean {
    return this.agentsApiOrigin !== null
  }

  get hasConfiguredAgentsWsOrigin(): boolean {
    return this.agentsWsOrigin !== null
  }

  get hasConfiguredNativeOrigin(): boolean {
    return this.hasConfiguredAgentsApiOrigin || this.hasConfiguredAgentsWsOrigin
  }
}

export class UrlBuilder {
  constructor(private readonly origins = new RuntimeOrigins()) {}

  agentsApiBaseUrl(): string {
    return this.withApiPrefix(this.origins.agentsApiOrigin)
  }

  authCurrentUserUrl(): string {
    return `${this.withApiPrefix(this.origins.authOrigin)}/auth/me`
  }

  sessionsEventsUrl(): string {
    return `${this.agentsApiBaseUrl()}/sessions/events`
  }

  workspaceRunnerEventsUrl(workspaceId: string): string {
    return `${this.agentsApiBaseUrl()}/workspaces/${encodeURIComponent(workspaceId)}/runner-events`
  }

  chatMessageStreamUrl(id: string): string {
    return `${this.agentsApiBaseUrl()}/chat-sessions/${encodeURIComponent(id)}/messages/stream`
  }

  sessionAttachWsUrl(options: SessionAttachUrlOptions): string {
    const base = `${this.agentsWsBaseUrl()}/ws/sessions/${encodeURIComponent(options.sessionId)}/attach`
    const params = new URLSearchParams()
    if (options.attachToken) params.set('attach-token', options.attachToken)
    if (options.epoch !== null && options.epoch !== undefined) params.set('epoch', String(options.epoch))
    if (options.offset !== null && options.offset !== undefined) params.set('offset', String(options.offset))
    const query = params.toString()
    return query ? `${base}?${query}` : base
  }

  private withApiPrefix(origin: string | null): string {
    return origin ? `${origin}${API_PREFIX}` : API_PREFIX
  }

  private agentsWsBaseUrl(): string {
    return this.withApiPrefix(this.origins.agentsWsOrigin ?? legacyAgentsWsOrigin())
  }
}

/**
 * Native bearer mode is gated until backend G2-G6 validate bearer identity at the trusted edge / agents-api JWT.
 */
export class CredentialsModePolicy {
  readonly mode: CredentialsMode
  private readonly tokenProvider: TokenProvider
  private readonly csrfTokenSource: () => string | null

  constructor(options: CredentialsModePolicyOptions = {}) {
    const origins = options.origins ?? new RuntimeOrigins()
    this.mode = options.mode ?? (origins.hasConfiguredNativeOrigin ? 'native-bearer' : 'web-cookie')
    this.tokenProvider = options.tokenProvider ?? nullTokenProvider
    this.csrfTokenSource = options.csrfTokenSource ?? defaultCsrfTokenSource
  }

  async restRequestInit(init: RequestInit = {}): Promise<RequestInit> {
    return this.requestInit(init)
  }

  async streamRequestInit(init: RequestInit = {}): Promise<RequestInit> {
    return this.requestInit(init)
  }

  statusStreamStrategy(): StatusStreamStrategy {
    return this.mode === 'native-bearer' ? 'fetch-sse' : 'eventsource'
  }

  wsAttach(options: SessionAttachUrlOptions): SessionAttachUrlOptions {
    if (this.mode === 'web-cookie') return options
    if (!options.attachToken) {
      throw new Error('Native bearer WebSocket attach requires a short-lived attach token')
    }
    return options
  }

  private async requestInit(init: RequestInit): Promise<RequestInit> {
    const headers = new Headers(init.headers)
    headers.delete('X-User-Id')

    if (this.mode === 'web-cookie') {
      const token = this.csrfTokenSource()
      if (token && !headers.has(CSRF_HEADER_NAME)) headers.set(CSRF_HEADER_NAME, token)
      headers.delete('Authorization')
      return {
        ...init,
        credentials: 'include',
        headers,
      }
    }

    const token = await this.tokenProvider.getAccessToken()
    if (!token) throw new Error('Native bearer credentials require an access token')
    headers.set('Authorization', `Bearer ${token}`)
    return {
      ...init,
      credentials: 'omit',
      headers,
    }
  }
}

export function createUrlBuilder(env?: RuntimeOriginEnv): UrlBuilder {
  return new UrlBuilder(new RuntimeOrigins(env))
}

/**
 * Native bearer mode is gated until backend G2-G6 validate bearer identity at the trusted edge / agents-api JWT.
 */
export function createCredentialsPolicy(options: CredentialsModePolicyOptions = {}): CredentialsModePolicy {
  return new CredentialsModePolicy(options)
}

export function defaultCsrfTokenSource(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1] ?? '') : null
}

function legacyAgentsWsOrigin(): string {
  if (typeof window === 'undefined') return 'ws://localhost:5174'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host.replace(/^agents\./, 'agents-ws.')}`
}
