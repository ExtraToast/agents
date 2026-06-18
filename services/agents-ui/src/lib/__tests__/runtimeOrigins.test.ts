import { describe, expect, it } from 'vitest'
import {
  CredentialsModePolicy,
  parseHttpOrigin,
  parseWsOrigin,
  RuntimeOrigins,
  UrlBuilder,
} from '../runtimeOrigins'

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

describe('runtimeOrigins', () => {
  it('parses and normalizes valid http origins', () => {
    expect(parseHttpOrigin('https://agents.example.com/')).toBe('https://agents.example.com')
    expect(parseHttpOrigin('http://localhost:5174')).toBe('http://localhost:5174')
  })

  it('rejects http origins with path, query, hash, or the wrong scheme', () => {
    expect(() => parseHttpOrigin('https://agents.example.com/api')).toThrow(/without path/)
    expect(() => parseHttpOrigin('https://agents.example.com?x=1')).toThrow(/without path/)
    expect(() => parseHttpOrigin('https://agents.example.com#x')).toThrow(/without path/)
    expect(() => parseHttpOrigin('wss://agents.example.com')).toThrow(/http or https/)
  })

  it('parses websocket origins separately from http origins', () => {
    expect(parseWsOrigin('wss://agents-ws.example.com/')).toBe('wss://agents-ws.example.com')
    expect(parseWsOrigin('ws://localhost:8082')).toBe('ws://localhost:8082')
    expect(() => parseWsOrigin('https://agents-ws.example.com')).toThrow(/ws or wss/)
  })

  it('falls back to same-origin agents API paths when production origins are unset', () => {
    const urls = new UrlBuilder(new RuntimeOrigins({}))

    expect(urls.agentsApiBaseUrl()).toBe('/api/v1')
    expect(urls.sessionsEventsUrl()).toBe('/api/v1/sessions/events')
    expect(urls.authCurrentUserUrl()).toBe('http://localhost:5174/api/v1/auth/me')
  })

  it('keeps VITE_AUTH_URL as an alias but prefers VITE_AUTH_ORIGIN', () => {
    const origins = new RuntimeOrigins({
      VITE_AUTH_URL: 'https://legacy-auth.example.com',
      VITE_AUTH_ORIGIN: 'https://auth.example.com',
    })
    const urls = new UrlBuilder(origins)

    expect(urls.authCurrentUserUrl()).toBe('https://auth.example.com/api/v1/auth/me')
  })

  it('builds absolute agents API URLs and encodes path/query values', () => {
    const urls = new UrlBuilder(new RuntimeOrigins({
      VITE_AGENTS_API_ORIGIN: 'https://api.example.com/',
      VITE_AGENTS_WS_ORIGIN: 'wss://ws.example.com/',
    }))

    expect(urls.agentsApiBaseUrl()).toBe('https://api.example.com/api/v1')
    expect(urls.sessionsEventsUrl()).toBe('https://api.example.com/api/v1/sessions/events')
    expect(urls.chatMessageStreamUrl('chat/space id')).toBe(
      'https://api.example.com/api/v1/chat-sessions/chat%2Fspace%20id/messages/stream',
    )
    expect(urls.sessionAttachWsUrl({
      sessionId: 'sess/1',
      attachToken: 'a token/with spaces',
      epoch: 7,
      offset: 12,
    })).toBe(
      'wss://ws.example.com/api/v1/ws/sessions/sess%2F1/attach?attach-token=a+token%2Fwith+spaces&epoch=7&offset=12',
    )
  })

  it('uses cookie credentials, CSRF, and EventSource by default', async () => {
    const policy = new CredentialsModePolicy({
      csrfTokenSource: () => 'csrf-token',
    })
    const init = await policy.restRequestInit({
      headers: {
        'Authorization': 'Bearer old',
        'X-User-Id': 'user-1',
      },
    })

    expect(policy.mode).toBe('web-cookie')
    expect(policy.statusStreamStrategy()).toBe('eventsource')
    expect(init.credentials).toBe('include')
    expect(header(init, 'X-XSRF-TOKEN')).toBe('csrf-token')
    expect(header(init, 'Authorization')).toBeNull()
    expect(header(init, 'X-User-Id')).toBeNull()
    expect(policy.wsAttach({ sessionId: 's1' })).toEqual({ sessionId: 's1' })
  })

  it('uses bearer credentials for native origins and never sends client user ids', async () => {
    const policy = new CredentialsModePolicy({
      origins: new RuntimeOrigins({ VITE_AGENTS_API_ORIGIN: 'https://api.example.com' }),
      tokenProvider: { getAccessToken: () => 'access-token' },
      csrfTokenSource: () => 'csrf-token',
    })
    const rest = await policy.restRequestInit({
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'user-1',
      },
    })
    const stream = await policy.streamRequestInit()

    expect(policy.mode).toBe('native-bearer')
    expect(policy.statusStreamStrategy()).toBe('fetch-sse')
    expect(rest.credentials).toBe('omit')
    expect(header(rest, 'Authorization')).toBe('Bearer access-token')
    expect(header(rest, 'X-XSRF-TOKEN')).toBeNull()
    expect(header(rest, 'X-User-Id')).toBeNull()
    expect(header(stream, 'Authorization')).toBe('Bearer access-token')
    expect(policy.wsAttach({ sessionId: 's1', attachToken: 'attach' })).toEqual({
      sessionId: 's1',
      attachToken: 'attach',
    })
  })

  it('fails clearly when native bearer credentials are unavailable', async () => {
    const policy = new CredentialsModePolicy({
      origins: new RuntimeOrigins({ VITE_AGENTS_API_ORIGIN: 'https://api.example.com' }),
    })

    await expect(policy.restRequestInit()).rejects.toThrow(/access token/)
    expect(() => policy.wsAttach({ sessionId: 's1' })).toThrow(/short-lived attach token/)
  })
})
