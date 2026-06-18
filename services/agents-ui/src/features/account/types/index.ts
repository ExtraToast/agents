import { z } from 'zod'

export const profileResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  totpEnabled: z.boolean(),
  createdAt: z.string(),
})

export const updateProfileRequestSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
})

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
})

export const totpEnrollResponseSchema = z.object({
  secret: z.string(),
  qrUri: z.string(),
})

export const totpVerifyRequestSchema = z.object({
  code: z.string(),
})

export type ProfileRole = 'ADMIN' | 'READONLY' | 'USER' | (string & Record<never, never>)

export interface ProfileResponse {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: ProfileRole
  totpEnabled: boolean
  createdAt: string
}

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
export type TotpEnrollResponse = z.infer<typeof totpEnrollResponseSchema>
export type TotpVerifyRequest = z.infer<typeof totpVerifyRequestSchema>
