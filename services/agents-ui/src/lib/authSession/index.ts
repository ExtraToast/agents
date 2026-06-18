import type {
  AccessTokenLease,
  AuthPlatform,
  AuthSessionPort,
  AuthUser,
  CredentialsModePolicy,
  CredentialsModePolicyRequest,
  NativeAuthConfig,
  TokenProvider,
} from './types'
import type { AuthFetch } from './tokenExchange'
import type { RefreshTokenStore } from './refreshTokenStore'
import { useAuth } from '../vueWebCommons'
import { createRefreshTokenStore } from './refreshTokenStore'
import { ReLoginRequiredError, createRefreshCoordinator } from './tokenExchange'

const ACCESS_TOKEN_REFRESH_SKEW_MS = 30_000

interface WebAuthDelegate {
  user: { value: AuthUser | null }
  fetchUser: () => Promise<unknown>
  logout: () => Promise<unknown>
}

export interface CreateAuthSessionOptions {
  platform?: AuthPlatform
  nativeConfig?: NativeAuthConfig | null
  refreshTokenStore?: RefreshTokenStore
  tokenFetch?: AuthFetch
  now?: () => number
  webAuth?: WebAuthDelegate
}

export function createAuthSession(options: CreateAuthSessionOptions = {}): AuthSessionPort {
  const platform = options.platform ?? defaultPlatform()
  const nativeConfig = options.nativeConfig ?? nativeConfigFromEnv()

  if (platform.platformInfo.isNative && nativeConfig) {
    return createNativeBearerSession(platform, nativeConfig, options)
  }

  return createWebCookieSession(options.webAuth ?? webAuthDelegateFromCommons())
}

function webAuthDelegateFromCommons(): WebAuthDelegate {
  const auth = useAuth()
  return {
    user: {
      get value(): AuthUser | null {
        const current = auth.user.value
        if (!current) return null
        return {
          id: current.id,
          username: current.username,
          email: current.email,
          role: current.role,
        }
      },
    },
    fetchUser: () => auth.fetchUser(),
    logout: () => auth.logout(),
  }
}

export function createTokenProvider(session: AuthSessionPort): TokenProvider {
  return {
    getAccessToken: () => session.getAccessToken(),
  }
}

export function createNativeBearerCredentialsModePolicy(tokenProvider: TokenProvider): CredentialsModePolicy {
  return {
    async prepare(request: CredentialsModePolicyRequest): Promise<CredentialsModePolicyRequest> {
      const headers = new Headers(request.headers)
      const token = await tokenProvider.getAccessToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      headers.delete('X-XSRF-TOKEN')
      headers.delete(['X', 'User', 'Id'].join('-'))

      return {
        ...request,
        headers,
        credentials: 'omit',
      }
    },
  }
}

function createWebCookieSession(auth: WebAuthDelegate): AuthSessionPort {
  const session: AuthSessionPort = {
    mode: 'web-cookie',
    restoreState: 'unknown',
    currentUser: () => auth.user.value,
    getAccessToken: async () => null,
    async restore(): Promise<void> {
      session.restoreState = 'restoring'
      await auth.fetchUser()
      session.restoreState = auth.user.value ? 'authenticated' : 'anonymous'
    },
    async logout(): Promise<void> {
      await auth.logout()
      session.restoreState = 'anonymous'
    },
  }

  return session
}

function createNativeBearerSession(
  platform: AuthPlatform,
  config: NativeAuthConfig,
  options: CreateAuthSessionOptions,
): AuthSessionPort {
  const now = options.now ?? Date.now
  const store = options.refreshTokenStore ?? createRefreshTokenStore(platform)
  const refreshCoordinator = createRefreshCoordinator(
    config,
    store,
    options.tokenFetch ? { fetch: options.tokenFetch } : {},
  )
  let accessLease: AccessTokenLease | null = null

  const session: AuthSessionPort = {
    mode: 'native-bearer',
    restoreState: 'unknown',
    currentUser: () => null,
    async getAccessToken(): Promise<string | null> {
      if (accessLease && accessLease.expiresAt - now() > ACCESS_TOKEN_REFRESH_SKEW_MS) return accessLease.token

      try {
        const result = await refreshCoordinator.refresh()
        accessLease = {
          token: result.accessToken,
          expiresAt: now() + result.accessTokenExpiresIn * 1000,
        }
        session.restoreState = 'authenticated'
        return accessLease.token
      } catch (error) {
        if (error instanceof ReLoginRequiredError) {
          accessLease = null
          session.restoreState = 'anonymous'
          return null
        }
        throw error
      }
    },
    async restore(): Promise<void> {
      session.restoreState = 'restoring'
      const token = await session.getAccessToken()
      session.restoreState = token ? 'authenticated' : 'anonymous'
    },
    async logout(): Promise<void> {
      accessLease = null
      await store.clear()
      session.restoreState = 'anonymous'
    },
  }

  return session
}

function nativeConfigFromEnv(): NativeAuthConfig | null {
  const clientId = import.meta.env.VITE_NATIVE_AUTH_CLIENT_ID
  const redirectUri = import.meta.env.VITE_NATIVE_AUTH_REDIRECT_URI
  if (!clientId || !redirectUri) return null

  const config: NativeAuthConfig = {
    clientId,
    redirectUri,
  }
  if (import.meta.env.VITE_AUTH_URL) config.authBaseUrl = import.meta.env.VITE_AUTH_URL
  if (import.meta.env.VITE_NATIVE_AUTH_SCOPE) config.scope = import.meta.env.VITE_NATIVE_AUTH_SCOPE
  return config
}

function defaultPlatform(): AuthPlatform {
  return {
    platformInfo: { isNative: false },
    secureStorage: {
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    },
  }
}

export type {
  AccessTokenLease,
  AuthPlatform,
  AuthRestoreState,
  AuthRole,
  AuthRuntimeMode,
  AuthSessionPort,
  AuthUser,
  CredentialsModePolicy,
  CredentialsModePolicyRequest,
  DeepLinkIntent,
  DeepLinkResult,
  NativeAuthConfig,
  SecureStorage,
  TokenProvider,
} from './types'
export type {
  RefreshTokenRecord,
  RefreshTokenStore,
} from './refreshTokenStore'
export type {
  AuthFetch,
  RefreshCoordinator,
  TokenExchangeResult,
} from './tokenExchange'

export {
  buildAuthorizeUrl,
  createS256CodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce'
export { parseDeepLinkCallback } from './deepLink'
export { createRefreshTokenStore, createRefreshTokenStoreFromStorage } from './refreshTokenStore'
export {
  ReLoginRequiredError,
  TokenExchangeError,
  createRefreshCoordinator,
  exchangeCode,
  refresh,
} from './tokenExchange'
