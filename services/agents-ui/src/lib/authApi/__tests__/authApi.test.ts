import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError, createAuthApiClient } from '../index'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

describe('authApi client', () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

  beforeEach(() => {
    fetchImpl.mockReset()
  })

  it('composes request URLs from the auth origin', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ id: 'user-1' }))
    const client = createAuthApiClient({
      fetchImpl,
      origins: { authOrigin: 'https://auth.example.test/' },
    })

    await client.get('/users/me')

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://auth.example.test/api/v1/users/me',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('sends credentials and CSRF on mutations but not on GET', async () => {
    fetchImpl.mockImplementation(async () => jsonResponse({ ok: true }))
    const client = createAuthApiClient({
      csrfTokenSource: () => 'csrf-token',
      fetchImpl,
      origins: { authOrigin: 'https://auth.example.test' },
    })

    await client.get('/users/me')
    await client.post('/auth/change-password', { currentPassword: 'old', newPassword: 'long-new-password' })

    const getInit = fetchImpl.mock.calls[0]![1]!
    const postInit = fetchImpl.mock.calls[1]![1]!

    expect(getInit.credentials).toBe('include')
    expect(getInit.headers).not.toMatchObject({ 'X-XSRF-TOKEN': 'csrf-token' })
    expect(postInit.credentials).toBe('include')
    expect(postInit.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': 'csrf-token',
    })
    expect(postInit.headers).not.toHaveProperty(['X', 'User', 'Id'].join('-'))
    expect(postInit.body).toBe(JSON.stringify({ currentPassword: 'old', newPassword: 'long-new-password' }))
  })

  it('can inject bearer authorization without changing cookie defaults', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ ok: true }))
    const client = createAuthApiClient({
      fetchImpl,
      origins: { authOrigin: 'https://auth.example.test' },
      tokenProvider: { token: () => 'native-token' },
    })

    await client.put('/users/me', { firstName: 'Ada' })

    expect(fetchImpl.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: 'Bearer native-token' })
  })

  it('returns undefined for 204 responses', async () => {
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }))
    const client = createAuthApiClient({ fetchImpl, origins: { authOrigin: 'https://auth.example.test' } })

    await expect(client.del('/totp')).resolves.toBeUndefined()
  })

  it('throws AuthApiError with problem detail on non-2xx responses', async () => {
    fetchImpl.mockImplementation(async () => jsonResponse({ detail: 'Current password is wrong' }, { status: 400 }))
    const client = createAuthApiClient({ fetchImpl, origins: { authOrigin: 'https://auth.example.test' } })

    await expect(client.post('/auth/change-password', {})).rejects.toMatchObject({
      message: 'Current password is wrong',
      status: 400,
    })

    await expect(client.post('/auth/change-password', {})).rejects.toBeInstanceOf(AuthApiError)
  })
})
