import type {
  ForgotPasswordRequest,
  RegisterUserRequest,
  ResetPasswordRequest,
} from '../types'
import { authApi } from '@/lib/authApi'

export async function register(body: RegisterUserRequest): Promise<void> {
  await authApi.post('/users/register', body)
}

export async function confirmEmail(token: string): Promise<void> {
  const query = new URLSearchParams({ token })
  await authApi.get(`/auth/confirm-email?${query.toString()}`)
}

export async function resendConfirmation(email: string): Promise<void> {
  await authApi.post('/auth/resend-confirmation', { email })
}

export async function forgotPassword(email: string): Promise<void> {
  const body: ForgotPasswordRequest = { email }
  await authApi.post('/auth/forgot-password', body)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const body: ResetPasswordRequest = { token, newPassword }
  await authApi.post('/auth/reset-password', body)
}
