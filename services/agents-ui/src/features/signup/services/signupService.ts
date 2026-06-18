import type {
  ForgotPasswordRequest,
  RegisterUserRequest,
  ResetPasswordRequest,
} from '../types'
import { UrlBuilder } from '@/lib/runtimeOrigins'

export class SignupServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'SignupServiceError'
  }
}

function authApiUrl(path: string): string {
  return new URL(path, new UrlBuilder().authCurrentUserUrl()).toString()
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(authApiUrl(path), {
    ...init,
    credentials: 'include',
  })
  if (!response.ok) throw new SignupServiceError(await errorMessage(response), response.status)
  if (response.status === 204) return undefined as T // eslint-disable-line ts/consistent-type-assertions

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return await response.json() as T // eslint-disable-line ts/consistent-type-assertions
  return await response.text() as T // eslint-disable-line ts/consistent-type-assertions
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return (await response.text()) || fallback

  try {
    const payload = await response.json() as unknown // eslint-disable-line ts/consistent-type-assertions
    if (isErrorPayload(payload)) return payload.message
    return fallback
  } catch {
    return fallback
  }
}

function isErrorPayload(payload: unknown): payload is { message: string } {
  return typeof payload === 'object'
    && payload !== null
    && 'message' in payload
    && typeof payload.message === 'string'
}

export async function register(body: RegisterUserRequest): Promise<void> {
  await postJson('../users/register', body)
}

export async function confirmEmail(token: string): Promise<void> {
  const query = new URLSearchParams({ token })
  await request(`confirm-email?${query.toString()}`, { method: 'GET' })
}

export async function resendConfirmation(email: string): Promise<void> {
  await postJson('resend-confirmation', { email })
}

export async function forgotPassword(email: string): Promise<void> {
  const body: ForgotPasswordRequest = { email }
  await postJson('forgot-password', body)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const body: ResetPasswordRequest = { token, newPassword }
  await postJson('reset-password', body)
}
