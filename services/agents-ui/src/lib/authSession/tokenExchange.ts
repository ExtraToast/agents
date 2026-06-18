import type { NativeAuthConfig } from './types'
import type { RefreshTokenStore } from './refreshTokenStore'

const TOKEN_PATH = '/api/oauth2/token'

export type AuthFetch = (input: string, init: RequestInit) => Promise<Response>

export interface ExchangeCodeInput {
  code: string
  verifier: string
  redirectUri: string
}

export interface RefreshInput {
  refreshToken: string
}

export interface TokenExchangeResult {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken?: string
}

export interface RefreshCoordinator {
  refresh: () => Promise<TokenExchangeResult>
}

export interface RefreshCoordinatorOptions {
  fetch?: AuthFetch
}

export class TokenExchangeError extends Error {
  constructor(message: string, readonly status: number | null = null, readonly oauthError: string | null = null) {
    super(message)
    this.name = 'TokenExchangeError'
  }
}

export class ReLoginRequiredError extends Error {
  constructor(message = 'Native auth refresh token is no longer valid') {
    super(message)
    this.name = 'ReLoginRequiredError'
  }
}

export async function exchangeCode(
  config: NativeAuthConfig,
  input: ExchangeCodeInput,
  fetcher: AuthFetch = globalThis.fetch,
): Promise<TokenExchangeResult> {
  return postTokenRequest(config, fetcher, {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
  }, false)
}

export async function refresh(
  config: NativeAuthConfig,
  input: RefreshInput,
  fetcher: AuthFetch = globalThis.fetch,
): Promise<TokenExchangeResult> {
  return postTokenRequest(config, fetcher, {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: input.refreshToken,
  }, true)
}

export function createRefreshCoordinator(
  config: NativeAuthConfig,
  store: RefreshTokenStore,
  options: RefreshCoordinatorOptions = {},
): RefreshCoordinator {
  const fetcher = options.fetch ?? globalThis.fetch
  let inFlight: Promise<TokenExchangeResult> | null = null

  return {
    refresh(): Promise<TokenExchangeResult> {
      if (inFlight) return inFlight

      inFlight = refreshOnce(config, store, fetcher).finally(() => {
        inFlight = null
      })

      return inFlight
    },
  }
}

async function refreshOnce(
  config: NativeAuthConfig,
  store: RefreshTokenStore,
  fetcher: AuthFetch,
): Promise<TokenExchangeResult> {
  const record = await store.read()
  if (!record) {
    await store.clear()
    throw new ReLoginRequiredError('Native auth refresh token is missing')
  }

  try {
    const result = await refresh(config, { refreshToken: record.refreshToken }, fetcher)
    if (result.refreshToken) await store.replace({ refreshToken: result.refreshToken })
    return result
  } catch (error) {
    if (error instanceof ReLoginRequiredError) {
      await store.clear()
      throw error
    }
    throw error
  }
}

async function postTokenRequest(
  config: NativeAuthConfig,
  fetcher: AuthFetch,
  body: Record<string, string>,
  reloginOnInvalidGrant: boolean,
): Promise<TokenExchangeResult> {
  const response = await fetcher(tokenEndpoint(config), {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })

  const payload = await readJsonRecord(response)

  if (!response.ok) {
    const oauthError = stringField(payload, 'error')
    const invalidRefreshToken = (response.status === 400 || response.status === 401) && oauthError === 'invalid_grant'
    if (reloginOnInvalidGrant && invalidRefreshToken) {
      throw new ReLoginRequiredError()
    }
    throw new TokenExchangeError(
      stringField(payload, 'error_description') ?? `OAuth token endpoint returned HTTP ${response.status}`,
      response.status,
      oauthError,
    )
  }

  const accessToken = stringField(payload, 'access_token') ?? stringField(payload, 'accessToken')
  const expiresIn = numberField(payload, 'expires_in') ?? numberField(payload, 'accessTokenExpiresIn')
  const rotatedRefreshToken = stringField(payload, 'refresh_token') ?? stringField(payload, 'refreshToken')

  if (!accessToken || expiresIn === null) {
    throw new TypeError('OAuth token response is missing an access token or expiry')
  }

  const result: TokenExchangeResult = {
    accessToken,
    accessTokenExpiresIn: expiresIn,
  }
  if (rotatedRefreshToken) result.refreshToken = rotatedRefreshToken
  return result
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json()
  if (!isRecord(parsed)) throw new TypeError('OAuth token response must be a JSON object')
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function tokenEndpoint(config: NativeAuthConfig): string {
  const path = config.tokenPath ?? TOKEN_PATH
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!config.authBaseUrl) return normalizedPath
  return `${config.authBaseUrl.replace(/\/+$/u, '')}${normalizedPath}`
}
