import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, createS256CodeChallenge, generateCodeVerifier, generateState } from '../authSession'

const UNRESERVED = /^[A-Za-z0-9._~-]+$/u

describe('authSession PKCE helpers', () => {
  it('generates verifier values in the PKCE length and charset bounds', () => {
    const verifier = generateCodeVerifier()

    expect(verifier).toHaveLength(64)
    expect(verifier).toMatch(UNRESERVED)
  })

  it('rejects verifier lengths outside the PKCE bounds', () => {
    expect(() => generateCodeVerifier(42)).toThrow(TypeError)
    expect(() => generateCodeVerifier(129)).toThrow(TypeError)
  })

  it('creates the RFC 7636 S256 challenge for a known verifier', async () => {
    await expect(createS256CodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('generates unique state values in the unreserved charset', () => {
    const states = Array.from({ length: 64 }, () => generateState())

    expect(new Set(states).size).toBe(states.length)
    expect(states.every((state) => state.length === 48 && UNRESERVED.test(state))).toBe(true)
  })

  it('builds an authorize URL without a client secret', () => {
    const url = buildAuthorizeUrl(
      {
        authBaseUrl: 'https://auth.example.test',
        clientId: 'agents-native',
        redirectUri: 'app://callback',
        scope: 'openid profile offline_access',
      },
      {
        codeChallenge: 'challenge',
        redirectUri: 'app://callback',
        state: 'state',
      },
    )
    const parsed = new URL(url)

    expect(parsed.pathname).toBe('/api/oauth2/authorize')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('agents-native')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('scope')).toBe('openid profile offline_access')
    expect(parsed.searchParams.get('redirect_uri')).toBe('app://callback')
    expect(parsed.searchParams.get('state')).toBe('state')
    expect(parsed.searchParams.has('client_secret')).toBe(false)
  })
})
