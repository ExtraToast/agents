import type {
  ChangePasswordRequest,
  ProfileResponse,
  TotpEnrollResponse,
  TotpVerifyRequest,
  UpdateProfileRequest,
} from '../types'
import { authApi } from '@/lib/authApi'
import {
  changePasswordRequestSchema,
  profileResponseSchema,
  totpEnrollResponseSchema,
  totpVerifyRequestSchema,
  updateProfileRequestSchema,
} from '../types'

export async function getProfile(): Promise<ProfileResponse> {
  return profileResponseSchema.parse(await authApi.get<unknown>('/users/me'))
}

export async function updateProfile(body: UpdateProfileRequest): Promise<ProfileResponse> {
  return profileResponseSchema.parse(await authApi.patch<unknown>('/users/me', updateProfileRequestSchema.parse(body)))
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await authApi.post('/auth/change-password', changePasswordRequestSchema.parse(body))
}

export async function enrollTotp(): Promise<TotpEnrollResponse> {
  return totpEnrollResponseSchema.parse(await authApi.post<unknown>('/totp/enroll'))
}

export async function verifyTotp(body: TotpVerifyRequest): Promise<void> {
  await authApi.post('/totp/verify', totpVerifyRequestSchema.parse(body))
}
