import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmEmail,
  forgotPassword,
  register,
  resendConfirmation,
  resetPassword,
  SignupServiceError,
} from '../services/signupService'

const fetchMock = vi.fn<typeof fetch>()
const authBase = `http://localhost:5174${['/api', 'v1'].join('/')}`

describe('signup service', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('posts registration to the auth users endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await register({
      username: 'ada',
      email: 'ada@example.test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'password1',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${authBase}/users/register`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'ada',
          email: 'ada@example.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
          password: 'password1',
        }),
      }),
    )
  })

  it('encodes the email confirmation token in the query string', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await confirmEmail('abc/123 +')

    expect(fetchMock).toHaveBeenCalledWith(
      `${authBase}/auth/confirm-email?token=abc%2F123+%2B`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('posts resend confirmation to the auth endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await resendConfirmation('ada@example.test')

    expect(fetchMock).toHaveBeenCalledWith(
      `${authBase}/auth/resend-confirmation`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ada@example.test' }),
      }),
    )
  })

  it('posts forgot password to the auth endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await forgotPassword('ada@example.test')

    expect(fetchMock).toHaveBeenCalledWith(
      `${authBase}/auth/forgot-password`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ada@example.test' }),
      }),
    )
  })

  it('posts reset password to the auth endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await resetPassword('token-1', 'password2')

    expect(fetchMock).toHaveBeenCalledWith(
      `${authBase}/auth/reset-password`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token-1', newPassword: 'password2' }),
      }),
    )
  })

  it('surfaces json error messages', async () => {
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ message: 'email already exists' }),
      {
        status: 409,
        headers: { 'content-type': 'application/json' },
      },
    ))

    await expect(resendConfirmation('ada@example.test')).rejects.toEqual(
      new SignupServiceError('email already exists', 409),
    )
  })
})
