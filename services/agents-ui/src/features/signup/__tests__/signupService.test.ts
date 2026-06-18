import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmEmail,
  forgotPassword,
  register,
  resendConfirmation,
  resetPassword,
} from '../services/signupService'

const authApiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/authApi', () => ({
  authApi: authApiMocks,
}))

describe('signup service', () => {
  beforeEach(() => {
    authApiMocks.get.mockReset()
    authApiMocks.post.mockReset()
  })

  it('posts registration to the auth users endpoint', async () => {
    authApiMocks.post.mockResolvedValue(undefined)

    const body = {
      username: 'ada',
      email: 'ada@example.test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'password1',
    }
    await register(body)

    expect(authApiMocks.post).toHaveBeenCalledWith('/users/register', body)
  })

  it('encodes the email confirmation token in the query string', async () => {
    authApiMocks.get.mockResolvedValue(undefined)

    await confirmEmail('abc/123 +')

    expect(authApiMocks.get).toHaveBeenCalledWith('/auth/confirm-email?token=abc%2F123+%2B')
  })

  it('posts resend confirmation to the auth endpoint', async () => {
    authApiMocks.post.mockResolvedValue(undefined)

    await resendConfirmation('ada@example.test')

    expect(authApiMocks.post).toHaveBeenCalledWith('/auth/resend-confirmation', { email: 'ada@example.test' })
  })

  it('posts forgot password to the auth endpoint', async () => {
    authApiMocks.post.mockResolvedValue(undefined)

    await forgotPassword('ada@example.test')

    expect(authApiMocks.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'ada@example.test' })
  })

  it('posts reset password to the auth endpoint', async () => {
    authApiMocks.post.mockResolvedValue(undefined)

    await resetPassword('token-1', 'password2')

    expect(authApiMocks.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'token-1',
      newPassword: 'password2',
    })
  })
})
