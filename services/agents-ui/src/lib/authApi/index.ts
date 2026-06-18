import { cookieCsrfTokenSource } from '@/lib/vueWebCommons'

const API_PREFIX = '/api/v1'
const MUTATING_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT'])

interface RuntimeOriginsModule {
  RuntimeOrigins: new () => AuthApiOrigins
}

export interface AuthApiOrigins {
  authOrigin: string
}

export interface AuthApiTokenProvider {
  token: () => Promise<string | null> | string | null
}

export interface AuthApiClientOptions {
  csrfTokenSource?: () => string | null
  fetchImpl?: typeof fetch
  origins?: AuthApiOrigins
  tokenProvider?: AuthApiTokenProvider
}

interface RequestOptions {
  body?: unknown
}

export class AuthApiError extends Error {
  readonly body: unknown
  readonly status: number

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.body = body
  }
}

export interface AuthApiClient {
  del: <T = void>(path: string) => Promise<T>
  get: <T>(path: string) => Promise<T>
  patch: <T>(path: string, body?: unknown) => Promise<T>
  post: <T = void>(path: string, body?: unknown) => Promise<T>
  put: <T>(path: string, body?: unknown) => Promise<T>
}

const runtimeOriginsModules = import.meta.glob<RuntimeOriginsModule>('../runtimeOrigins.ts', { eager: true })

export function createAuthApiClient(options: AuthApiClientOptions = {}): AuthApiClient {
  const client = new AuthApiTransport(options)
  return {
    del: <T = void>(path: string) => client.request<T>('DELETE', path),
    get: <T>(path: string) => client.request<T>('GET', path),
    patch: <T>(path: string, body?: unknown) => client.request<T>('PATCH', path, { body }),
    post: <T = void>(path: string, body?: unknown) => client.request<T>('POST', path, { body }),
    put: <T>(path: string, body?: unknown) => client.request<T>('PUT', path, { body }),
  }
}

class AuthApiTransport {
  private readonly csrfTokenSource: () => string | null
  private readonly fetchImpl: typeof fetch
  private readonly origins: AuthApiOrigins | undefined
  private readonly tokenProvider: AuthApiTokenProvider | undefined

  constructor(options: AuthApiClientOptions) {
    this.csrfTokenSource = options.csrfTokenSource ?? defaultCsrfTokenSource
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
    this.origins = options.origins
    this.tokenProvider = options.tokenProvider
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }

    if (options.body !== undefined) headers['Content-Type'] = 'application/json'

    if (MUTATING_METHODS.has(method)) {
      const csrfToken = this.csrfTokenSource()
      if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken
    }

    const bearerToken = await this.tokenProvider?.token()
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`

    const init: RequestInit = {
      credentials: 'include',
      headers,
      method,
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)

    const response = await this.fetchImpl(this.urlFor(path), init)

    if (response.status === 204) return undefined as T // eslint-disable-line ts/consistent-type-assertions

    const parsed = await parseBody(response)
    if (!response.ok) throw new AuthApiError(response.status, problemMessage(parsed, response.statusText), parsed)

    return parsed as T // eslint-disable-line ts/consistent-type-assertions
  }

  private urlFor(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${this.baseUrl()}${normalizedPath}`
  }

  private baseUrl(): string {
    const origin = this.origins?.authOrigin ?? defaultAuthOrigin()
    return `${origin.replace(/\/+$/, '')}${API_PREFIX}`
  }
}

function defaultAuthOrigin(): string {
  const runtimeOrigins = Object.values(runtimeOriginsModules)[0]
  if (!runtimeOrigins) throw new TypeError('RuntimeOrigins module is unavailable')
  return new runtimeOrigins.RuntimeOrigins().authOrigin
}

function defaultCsrfTokenSource(): string | null {
  if (typeof document === 'undefined') return null
  return cookieCsrfTokenSource('XSRF-TOKEN', document)()
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) return text

  try {
    return JSON.parse(text) as unknown // eslint-disable-line ts/consistent-type-assertions
  } catch {
    return text
  }
}

function problemMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback || 'Auth API request failed'

  const detail = stringValue(body.detail)
  if (detail) return detail

  const message = stringValue(body.message)
  if (message) return message

  const title = stringValue(body.title)
  if (title) return title

  return fallback || 'Auth API request failed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// Declared after the class/helpers it depends on so the module-load singleton
// does not hit a temporal-dead-zone on AuthApiTransport.
export const authApi = createAuthApiClient()
