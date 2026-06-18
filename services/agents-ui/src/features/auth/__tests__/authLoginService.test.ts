import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logout, sessionLogin } from '../services/authLoginService'

const fetchMock = vi.fn<typeof fetch>()
const apiPrefix = ['/api', '/v1'].join('')

describe('auth login service', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; Max-Age=0'
  })

  it('posts session login through the auth api with cookie csrf credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, totpRequired: false }))

    await expect(sessionLogin({ username: 'alice', password: 'secret' })).resolves.toEqual({
      success: true,
      totpRequired: false,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)

    expect(url).toBe(`http://localhost:5174${apiPrefix}/auth/session-login`)
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf-token')
    expect(init?.body).toBe(JSON.stringify({ username: 'alice', password: 'secret' }))
  })

  it('includes totp code when provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, totpRequired: false }))

    await sessionLogin({ username: 'alice', password: 'secret', totpCode: '123456' })

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      username: 'alice',
      password: 'secret',
      totpCode: '123456',
    }))
  })

  it('posts logout through the auth api', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await logout()

    const [url, init] = fetchMock.mock.calls[0] ?? []

    expect(url).toBe(`http://localhost:5174${apiPrefix}/auth/logout`)
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
  })
})

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}
