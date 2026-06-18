import { createCredentialsPolicy, createUrlBuilder } from '@/lib/runtimeOrigins'

export interface SessionLoginInput {
  username: string;
  password: string;
  totpCode?: string | undefined;
}

export interface SessionLoginUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
}

export interface SessionLoginResponse {
  success: boolean;
  totpRequired: boolean;
  user?: SessionLoginUser | undefined;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

export async function sessionLogin(input: SessionLoginInput): Promise<SessionLoginResponse> {
  const body: SessionLoginInput = {
    username: input.username,
    password: input.password,
  }

  if (input.totpCode !== undefined) {
    body.totpCode = input.totpCode
  }

  const response = await authFetch('session-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<SessionLoginResponse>(response)
}

export async function logout(): Promise<void> {
  const response = await authFetch('logout', { method: 'POST' })
  if (!response.ok) throw await errorFromResponse(response)
}

async function authFetch(endpoint: string, init: RequestInit): Promise<Response> {
  const url = new URL(endpoint, createUrlBuilder().authCurrentUserUrl()).toString()
  const policy = createCredentialsPolicy()
  return fetch(url, await policy.restRequestInit(init))
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await errorFromResponse(response)

  const payload: unknown = await response.json()
  if (payload === null || typeof payload !== 'object') {
    throw new TypeError('Auth API response must be an object')
  }

  return payload as T // eslint-disable-line ts/consistent-type-assertions
}

async function errorFromResponse(response: Response): Promise<AuthApiError> {
  const message = await responseMessage(response)
  return new AuthApiError(message, response.status)
}

async function responseMessage(response: Response): Promise<string> {
  const fallback = `Authentication request failed (${response.status})`
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    return text.trim() || fallback
  }

  const payload: unknown = await response.json()
  if (payload === null || typeof payload !== 'object') return fallback
  if ('message' in payload && typeof payload.message === 'string') return payload.message
  if ('error' in payload && typeof payload.error === 'string') return payload.error

  return fallback
}
