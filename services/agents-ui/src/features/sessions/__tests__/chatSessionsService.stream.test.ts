import type { ChatStreamHandlers } from '../services/chatSessionsService'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChatAnswer } from '../services/chatSessionsService'

function streamResponse(body: string): Response {
  return new Response(body)
}

function handlers(): ChatStreamHandlers {
  return {
    onChunk: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  }
}

describe('chatSessionsService streamChatAnswer', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; Max-Age=0'
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('streams with cookie credentials and CSRF by default', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      streamResponse('event: chunk\ndata: {"text":"hi"}\n\nevent: done\ndata: {"messageId":"m1"}\n\n'))
    vi.stubGlobal('fetch', fetchMock)
    const h = handlers()

    await streamChatAnswer('chat 1', 'hello', h)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/chat-sessions/chat%201/messages/stream')
    const init = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(init?.credentials).toBe('include')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf-token')
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('X-User-Id')).toBeNull()
    expect(h.onChunk).toHaveBeenCalledWith('hi')
    expect(h.onDone).toHaveBeenCalledWith('m1')
    expect(h.onError).not.toHaveBeenCalled()
  })

  it('streams with bearer credentials for configured native origins', async () => {
    vi.stubEnv('VITE_AGENTS_API_ORIGIN', 'https://api.example.com')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      streamResponse('event: done\ndata: {"messageId":"m1"}\n\n'))
    vi.stubGlobal('fetch', fetchMock)
    const h = handlers()

    await streamChatAnswer('chat/1', 'hello', h, undefined, { getAccessToken: () => 'access-token' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/api/v1/chat-sessions/chat%2F1/messages/stream')
    const init = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(init?.credentials).toBe('omit')
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(headers.get('X-XSRF-TOKEN')).toBeNull()
    expect(headers.get('X-User-Id')).toBeNull()
    expect(h.onDone).toHaveBeenCalledWith('m1')
  })

  it('reports a clear error when native bearer token is missing', async () => {
    vi.stubEnv('VITE_AGENTS_API_ORIGIN', 'https://api.example.com')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const h = handlers()

    await streamChatAnswer('chat-1', 'hello', h)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.onError).toHaveBeenCalledWith(expect.stringMatching(/access token/))
  })
})
