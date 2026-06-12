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

export * from '@extratoast/vue-web-commons'

const authBaseUrl: string = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:5174'
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
  return useCommonsAuth<SessionUserPayload, User<AgentsRole>>({
    baseUrl: authBaseUrl,
    currentUserUrl: '/api/v1/auth/me',
    credentials: 'include',
    csrfTokenSource,
    mapUser,
  })
}

export function useApiWithAuth(options: ApiWithAuthOptions = {}): ApiClient {
  const { getCsrfToken, logout } = useAuth()
  return useCommonsApiWithAuth({
    baseUrl: '/api/v1',
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

function mapUser(payload: SessionUserPayload): User<AgentsRole> {
  const role = validRoles.find((candidate) => candidate === payload.role) ?? 'USER'
  return {
    id: payload.id ?? '',
    username: payload.username ?? payload.name ?? '',
    email: payload.email ?? '',
    role,
  }
}
