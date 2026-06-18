import { z } from 'zod'

export const registerUserRequestSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.email('Enter a valid email address'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const resendConfirmationRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export const forgotPasswordRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export const resetPasswordRequestSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export const passwordConfirmationSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
})

export type RegisterUserRequest = z.infer<typeof registerUserRequestSchema>
export type ResendConfirmationRequest = z.infer<typeof resendConfirmationRequestSchema>
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>
