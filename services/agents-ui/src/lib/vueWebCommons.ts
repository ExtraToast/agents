import type {
  ApiClient,
  ApiWithAuthOptions,
  AuthApi,
  ThemeApi,
  ThemeMode,
  User,
  UseThemeOptions,
} from '@extratoast/vue-web-commons'
import {
  cookieCsrfTokenSource,
  useApiWithAuth as useCommonsApiWithAuth,
  useAuth as useCommonsAuth,
  useTheme as useCommonsTheme,
} from '@extratoast/vue-web-commons'
import { CredentialsModePolicy, UrlBuilder } from './runtimeOrigins'

export * from '@extratoast/vue-web-commons'

const validRoles = ['ADMIN', 'USER', 'READONLY'] as const
type AgentsRole = (typeof validRoles)[number]

interface SessionUserPayload {
  id?: string
  username?: string
  name?: string
  email?: string
  role?: string
}

export const agentsThemeOptions = {
  storageKey: 'agents_theme',
  defaultMode: 'system',
  allowedModes: ['light', 'dark', 'system'],
  target: () => (typeof document === 'undefined' ? null : document.documentElement),
  attribute: 'data-theme',
  className: 'dark',
} satisfies UseThemeOptions<ThemeMode>

export function useAuth(): AuthApi<User<AgentsRole>> {
  const urlBuilder = new UrlBuilder()
  const currentUserUrl = new URL(urlBuilder.authCurrentUserUrl())
  return useCommonsAuth<SessionUserPayload, User<AgentsRole>>({
    baseUrl: currentUserUrl.origin,
    currentUserUrl: currentUserUrl.pathname,
    credentials: 'include',
    csrfTokenSource,
    mapUser,
  })
}

export function useApiWithAuth(options: ApiWithAuthOptions = {}): ApiClient {
  const urlBuilder = new UrlBuilder()
  const policy = new CredentialsModePolicy({ csrfTokenSource })
  if (policy.mode === 'native-bearer') return createBearerApiClient(urlBuilder.agentsApiBaseUrl(), policy)

  const { getCsrfToken, logout } = useAuth()
  return useCommonsApiWithAuth({
    baseUrl: urlBuilder.agentsApiBaseUrl(),
    credentials: 'include',
    csrfTokenSource: getCsrfToken,
    csrfHeaderName: 'X-XSRF-TOKEN',
    logout,
    ...options,
  })
}

export function useTheme(): ThemeApi<ThemeMode> {
  return useCommonsTheme(agentsThemeOptions)
}

function csrfTokenSource(): string | null {
  if (typeof document === 'undefined') return null
  return cookieCsrfTokenSource('XSRF-TOKEN', document)()
}

function createBearerApiClient(baseUrl: string, policy: CredentialsModePolicy): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const requestInit: RequestInit = { method }
    if (body !== undefined) {
      requestInit.headers = { 'Content-Type': 'application/json' }
      requestInit.body = JSON.stringify(body)
    }
    const init = await policy.restRequestInit(requestInit)
    const response = await fetch(`${baseUrl}${path}`, init)
    if (!response.ok) throw new Error(`API request failed (${response.status})`)
    if (response.status === 204) return undefined as T // eslint-disable-line ts/consistent-type-assertions

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return await response.json() as T // eslint-disable-line ts/consistent-type-assertions
    }
    return await response.text() as T // eslint-disable-line ts/consistent-type-assertions
  }

  const client = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    del: <T>(path: string) => request<T>('DELETE', path),
  }
  // eslint-disable-next-line ts/consistent-type-assertions -- shape matches ApiClient; generics differ structurally
  return client as unknown as ApiClient
}

function mapUser(payload: SessionUserPayload): User<AgentsRole> {
  const role = validRoles.find((candidate) => candidate === payload.role) ?? 'USER'
  return {
    id: payload.id ?? '',
    username: payload.username ?? payload.name ?? '',
    email: payload.email ?? '',
    role,
  }
}
