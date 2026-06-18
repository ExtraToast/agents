import type { NativeAuthConfig, RefreshTokenStore } from '../authSession'
import type { AuthFetch } from '../authSession/tokenExchange'
import { describe, expect, it, vi } from 'vitest'
import { ReLoginRequiredError, createRefreshCoordinator, exchangeCode, refresh } from '../authSession'

const config: NativeAuthConfig = {
  authBaseUrl: 'https://auth.example.test',
  clientId: 'agents-native',
  redirectUri: 'app://auth/callback',
}

describe('authSession token exchange', () => {
  it('exchanges an authorization code without cookies or client secret', async () => {
    const fetcher = vi.fn<AuthFetch>(async () => jsonResponse({
      access_token: 'access-token-1',
      expires_in: 300,
      refresh_token: 'refresh-token-1',
    }))

    await expect(exchangeCode(
      config,
      { code: 'auth-code-1', verifier: 'pkce-verifier-1', redirectUri: 'app://auth/callback' },
      fetcher,
    )).resolves.toEqual({
      accessToken: 'access-token-1',
      accessTokenExpiresIn: 300,
      refreshToken: 'refresh-token-1',
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('https://auth.example.test/api/oauth2/token')
    expect(init?.credentials).toBe('omit')
    expect(init?.body).toContain('grant_type=authorization_code')
    expect(init?.body).toContain('code=auth-code-1')
    expect(init?.body).toContain('code_verifier=pkce-verifier-1')
    expect(init?.body).not.toContain('client_secret')
  })

  it('refreshes a token without cookies', async () => {
    const fetcher = vi.fn<AuthFetch>(async () => jsonResponse({
      access_token: 'access-token-2',
      expires_in: 600,
    }))

    await expect(refresh(config, { refreshToken: 'refresh-token-1' }, fetcher)).resolves.toEqual({
      accessToken: 'access-token-2',
      accessTokenExpiresIn: 600,
    })

    const [, init] = fetcher.mock.calls[0] ?? []
    expect(init?.credentials).toBe('omit')
    expect(init?.body).toContain('grant_type=refresh_token')
    expect(init?.body).toContain('refresh_token=refresh-token-1')
  })

  it('single-flights concurrent refreshes and atomically replaces rotated refresh tokens', async () => {
    const store = memoryStore('refresh-token-1')
    let resolveFetch: (response: Response) => void = () => {}
    const fetcher = vi.fn<AuthFetch>(() => new Promise((resolve) => {
      resolveFetch = resolve
    }))
    const coordinator = createRefreshCoordinator(config, store, { fetch: fetcher })

    const first = coordinator.refresh()
    const second = coordinator.refresh()
    resolveFetch(jsonResponse({
      access_token: 'access-token-rotated',
      expires_in: 300,
      refresh_token: 'refresh-token-2',
    }))

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        accessToken: 'access-token-rotated',
        accessTokenExpiresIn: 300,
        refreshToken: 'refresh-token-2',
      },
      {
        accessToken: 'access-token-rotated',
        accessTokenExpiresIn: 300,
        refreshToken: 'refresh-token-2',
      },
    ])
    await expect(store.read()).resolves.toEqual({ refreshToken: 'refresh-token-2' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('clears the refresh token family and requires re-login for invalid refresh tokens', async () => {
    const store = memoryStore('expired-refresh-token')
    const fetcher = vi.fn<AuthFetch>(async () => jsonResponse({ error: 'invalid_grant' }, 400))
    const coordinator = createRefreshCoordinator(config, store, { fetch: fetcher })

    await expect(coordinator.refresh()).rejects.toBeInstanceOf(ReLoginRequiredError)
    await expect(store.read()).resolves.toBeNull()
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function memoryStore(refreshToken: string | null): RefreshTokenStore {
  let value = refreshToken
  return {
    read: vi.fn(async () => value === null ? null : { refreshToken: value }),
    replace: vi.fn(async (record) => {
      value = record.refreshToken
    }),
    clear: vi.fn(async () => {
      value = null
    }),
  }
}
