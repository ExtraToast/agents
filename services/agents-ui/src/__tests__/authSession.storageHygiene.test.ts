import type { NativeAuthConfig, SecureStorage } from '../lib/authSession'
import type { AuthFetch } from '../lib/authSession/tokenExchange'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthSession, exchangeCode } from '../lib/authSession'

const config: NativeAuthConfig = {
  authBaseUrl: 'https://auth.example.test',
  clientId: 'agents-native',
  redirectUri: 'app://auth/callback',
}

describe('native auth storage hygiene', () => {
  const originalLocalStorage = globalThis.localStorage
  const originalSessionStorage = globalThis.sessionStorage
  const originalIndexedDb = globalThis.indexedDB

  afterEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('localStorage', originalLocalStorage)
    vi.stubGlobal('sessionStorage', originalSessionStorage)
    vi.stubGlobal('indexedDB', originalIndexedDb)
  })

  it('never writes OAuth secrets to browser persistence or console sinks', async () => {
    const forbiddenSecrets = [
      'auth-code-secret',
      'pkce-verifier-secret',
      'access-token-secret-1',
      'access-token-secret-2',
      'refresh-token-secret-1',
      'refresh-token-secret-2',
      'attach-token-secret',
    ]
    const writes: unknown[] = []
    const localStorage = trapStorage(writes)
    const sessionStorage = trapStorage(writes)
    const indexedDb = {
      open: vi.fn((...args: unknown[]) => {
        writes.push(args)
        return {}
      }),
      deleteDatabase: vi.fn((...args: unknown[]) => {
        writes.push(args)
        return {}
      }),
    }
    // eslint-disable-next-line no-console
    const consoleLog = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      writes.push(args)
    })
    // eslint-disable-next-line no-console
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      writes.push(args)
    })
    // eslint-disable-next-line no-console
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      writes.push(args)
    })
    const secureStorage = memorySecureStorage(null)
    const fetcher = vi.fn<AuthFetch>(async (_url, init) => {
      if (String(init.body).includes('authorization_code')) {
        return jsonResponse({
          access_token: 'access-token-secret-1',
          expires_in: 1,
          refresh_token: 'refresh-token-secret-1',
        })
      }

      return jsonResponse({
        access_token: 'access-token-secret-2',
        expires_in: 120,
        refresh_token: 'refresh-token-secret-2',
      })
    })

    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('sessionStorage', sessionStorage)
    vi.stubGlobal('indexedDB', indexedDb)

    const codeResult = await exchangeCode(
      config,
      {
        code: 'auth-code-secret',
        verifier: 'pkce-verifier-secret',
        redirectUri: config.redirectUri,
      },
      fetcher,
    )
    if (!codeResult.refreshToken) throw new TypeError('Authorization code exchange did not return a refresh token')
    await secureStorage.set('agents.nativeAuth.refreshToken', codeResult.refreshToken)

    let now = 1000
    const session = createAuthSession({
      platform: {
        platformInfo: { isNative: true },
        secureStorage,
      },
      nativeConfig: config,
      tokenFetch: fetcher,
      now: () => now,
    })

    await expect(session.getAccessToken()).resolves.toBe('access-token-secret-2')
    now += 1000
    await expect(session.getAccessToken()).resolves.toBe('access-token-secret-2')

    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(sessionStorage.setItem).not.toHaveBeenCalled()
    expect(indexedDb.open).not.toHaveBeenCalled()
    expect(indexedDb.deleteDatabase).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    const serializedWrites = JSON.stringify(writes)
    for (const secret of forbiddenSecrets) expect(serializedWrites).not.toContain(secret)
  })
})

function trapStorage(writes: unknown[]): Storage {
  const values = new Map<string, string>()
  return {
    get length(): number {
      return values.size
    },
    clear: vi.fn(() => {
      values.clear()
    }),
    getItem: vi.fn((key) => values.get(key) ?? null),
    key: vi.fn((index) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key) => {
      values.delete(key)
    }),
    setItem: vi.fn((key, value) => {
      writes.push([key, value])
      values.set(key, value)
    }),
  }
}

function memorySecureStorage(initialRefreshToken: string | null): SecureStorage {
  let value = initialRefreshToken
  return {
    get: vi.fn(async () => value),
    set: vi.fn(async (_key, nextValue) => {
      value = nextValue
    }),
    remove: vi.fn(async () => {
      value = null
    }),
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
