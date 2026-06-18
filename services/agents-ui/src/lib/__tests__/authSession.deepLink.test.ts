import { describe, expect, it } from 'vitest'
import { parseDeepLinkCallback } from '../authSession'

describe('authSession deep link parser', () => {
  it('extracts code and state from a valid callback', () => {
    expect(parseDeepLinkCallback(
      'app://auth/callback?code=auth-code&state=state-1',
      { redirectUri: 'app://auth/callback', expectedState: 'state-1' },
    )).toMatchObject({
      ok: true,
      code: 'auth-code',
      state: 'state-1',
      error: null,
      stateMatches: true,
    })
  })

  it('surfaces state mismatches to the caller', () => {
    expect(parseDeepLinkCallback(
      { url: 'app://auth/callback?code=auth-code&state=wrong-state' },
      { redirectUri: 'app://auth/callback', expectedState: 'state-1' },
    )).toMatchObject({
      ok: false,
      code: 'auth-code',
      state: 'wrong-state',
      stateMatches: false,
    })
  })

  it('extracts OAuth error callbacks', () => {
    expect(parseDeepLinkCallback(
      'app://auth/callback?error=access_denied&error_description=Denied&state=state-1',
      { redirectUri: 'app://auth/callback', expectedState: 'state-1' },
    )).toMatchObject({
      ok: false,
      code: null,
      state: 'state-1',
      error: 'access_denied',
      errorDescription: 'Denied',
      stateMatches: true,
    })
  })

  it('rejects callbacks outside the configured redirect URI', () => {
    expect(parseDeepLinkCallback(
      'app://other/callback?code=auth-code&state=state-1',
      { redirectUri: 'app://auth/callback', expectedState: 'state-1' },
    )).toMatchObject({
      ok: false,
      code: null,
      state: null,
      error: 'invalid_redirect_uri',
    })
  })
})
