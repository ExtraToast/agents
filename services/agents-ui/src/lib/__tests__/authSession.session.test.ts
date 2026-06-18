import type { AuthPlatform, AuthUser, NativeAuthConfig, SecureStorage } from '../authSession'
import type { AuthFetch } from '../authSession/tokenExchange'
import { describe, expect, it, vi } from 'vitest'
import { createAuthSession, createNativeBearerCredentialsModePolicy, createTokenProvider } from '../authSession'

const nativeConfig: NativeAuthConfig = {
  authBaseUrl: 'https://auth.example.test',
  clientId: 'agents-native',
  redirectUri: 'app://auth/callback',
}

describe('authSession implementation', () => {
  it('keeps web-cookie behavior delegated to existing cookie auth and never reads secure storage', async () => {
    const user: AuthUser = { id: 'u1', username: 'alice', email: 'alice@example.test', role: 'USER' }
    const webAuth = {
      user: { value: user },
      fetchUser: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
    }
    const storage: SecureStorage = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    }

    const session = createAuthSession({
      platform: { platformInfo: { isNative: false }, secureStorage: storage },
      nativeConfig,
      webAuth,
    })

    expect(session.mode).toBe('web-cookie')
    expect(session.currentUser()).toBe(user)
    await expect(session.getAccessToken()).resolves.toBeNull()
    await session.restore()
    await session.logout()

    expect(webAuth.fetchUser).toHaveBeenCalledTimes(1)
    expect(webAuth.logout).toHaveBeenCalledTimes(1)
    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.set).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })

  it('uses a memory-only native bearer lease and does not persist access tokens', async () => {
    const storage = memoryStorage('refresh-token-1')
    const fetcher = vi.fn<AuthFetch>(async () => jsonResponse({
      access_token: 'access-token-1',
      expires_in: 120,
      refresh_token: 'refresh-token-2',
    }))
    const session = createAuthSession({
      platform: nativePlatform(storage),
      nativeConfig,
      tokenFetch: fetcher,
      now: () => 1000,
    })

    await expect(session.getAccessToken()).resolves.toBe('access-token-1')
    await expect(session.getAccessToken()).resolves.toBe('access-token-1')

    expect(session.mode).toBe('native-bearer')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(storage.writes).toEqual([['agents.nativeAuth.refreshToken', 'refresh-token-2']])
    expect(storage.writes.flat()).not.toContain('access-token-1')
  })

  it('native bearer policy injects Authorization and omits ambient credentials', async () => {
    const session = createAuthSession({
      platform: nativePlatform(memoryStorage('refresh-token-1')),
      nativeConfig,
      tokenFetch: vi.fn<AuthFetch>(async () => jsonResponse({
        access_token: 'access-token-policy',
        expires_in: 120,
      })),
      now: () => 1000,
    })
    const policy = createNativeBearerCredentialsModePolicy(createTokenProvider(session))
    const requestHeaderName = ['X', 'User', 'Id'].join('-')
    const prepared = await policy.prepare({
      credentials: 'include',
      headers: new Headers([
        ['X-XSRF-TOKEN', 'csrf-token'],
        [requestHeaderName, 'u1'],
      ]),
    })

    expect(prepared.credentials).toBe('omit')
    expect(prepared.headers?.get('Authorization')).toBe('Bearer access-token-policy')
    expect(prepared.headers?.has('X-XSRF-TOKEN')).toBe(false)
    expect(prepared.headers?.has(requestHeaderName)).toBe(false)
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function nativePlatform(secureStorage: SecureStorage): AuthPlatform {
  return {
    platformInfo: { isNative: true },
    secureStorage,
  }
}

function memoryStorage(initialRefreshToken: string | null): SecureStorage & { writes: string[][] } {
  let value = initialRefreshToken
  const writes: string[][] = []
  return {
    writes,
    get: vi.fn(async () => value),
    set: vi.fn(async (key, nextValue) => {
      writes.push([key, nextValue])
      value = nextValue
    }),
    remove: vi.fn(async () => {
      value = null
    }),
  }
}
