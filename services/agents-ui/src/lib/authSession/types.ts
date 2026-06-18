export type AuthRuntimeMode = 'web-cookie' | 'native-bearer'

export type AuthRestoreState = 'unknown' | 'restoring' | 'authenticated' | 'anonymous'

export type AuthRole = 'ADMIN' | 'USER' | 'READONLY'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: AuthRole
}

export interface AccessTokenLease {
  token: string
  expiresAt: number
}

export interface AuthSessionPort {
  mode: AuthRuntimeMode
  restoreState: AuthRestoreState
  currentUser: () => AuthUser | null
  getAccessToken: () => Promise<string | null>
  restore: () => Promise<void>
  logout: () => Promise<void>
}

export interface DeepLinkIntent {
  url: string
}

export interface DeepLinkResult {
  ok: boolean
  code: string | null
  state: string | null
  error: string | null
  errorDescription: string | null
  stateMatches: boolean | null
}

export interface TokenProvider {
  getAccessToken: () => Promise<string | null>
}

export interface NativeAuthConfig {
  authBaseUrl?: string
  authorizePath?: string
  tokenPath?: string
  clientId: string
  scope?: string
  redirectUri: string
}

export interface PlatformInfo {
  isNative: boolean
}

export interface SecureStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
}

export interface AuthPlatform {
  platformInfo: PlatformInfo
  secureStorage: SecureStorage
}

export interface CredentialsModePolicyRequest {
  headers?: Headers
  credentials?: RequestCredentials
}

export interface CredentialsModePolicy {
  prepare: (request: CredentialsModePolicyRequest) => Promise<CredentialsModePolicyRequest>
}
