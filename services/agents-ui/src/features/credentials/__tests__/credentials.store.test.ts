import type { CredentialSession } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelSession, getSession, getStoredStatus, startSession, submitRedirectUrl } from '../services/credentialsService'
import { useCredentialsStore } from '../stores/credentials'

vi.mock('../services/credentialsService', () => ({
  startSession: vi.fn(),
  getSession: vi.fn(),
  submitRedirectUrl: vi.fn(),
  cancelSession: vi.fn(),
  getStoredStatus: vi.fn(),
}))

const mocked = {
  startSession: vi.mocked(startSession),
  getSession: vi.mocked(getSession),
  submitRedirectUrl: vi.mocked(submitRedirectUrl),
  cancelSession: vi.mocked(cancelSession),
  getStoredStatus: vi.mocked(getStoredStatus),
}

function session(overrides: Partial<CredentialSession> = {}): CredentialSession {
  return {
    id: 's1',
    provider: 'claude',
    phase: 'awaiting_url',
    needsRedirectUrl: true,
    authorizeUrl: 'https://claude.ai/oauth/authorize?code=1',
    ...overrides,
  }
}

describe('credentials store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('start sets the session and polls until a terminal phase', async () => {
    mocked.startSession.mockResolvedValue(session())
    mocked.getSession.mockResolvedValue(session({ phase: 'succeeded', needsRedirectUrl: false }))
    const store = useCredentialsStore()

    await store.start('claude')
    expect(store.states.claude.session?.phase).toBe('awaiting_url')
    expect(mocked.startSession).toHaveBeenCalledWith('claude')

    await vi.advanceTimersByTimeAsync(2000)
    expect(mocked.getSession).toHaveBeenCalledWith('s1')
    expect(store.states.claude.session?.phase).toBe('succeeded')

    // Terminal phase stops the poll: no further calls after another interval.
    const calls = mocked.getSession.mock.calls.length
    await vi.advanceTimersByTimeAsync(4000)
    expect(mocked.getSession.mock.calls.length).toBe(calls)
  })

  it('does not poll when start returns an already-terminal session', async () => {
    mocked.startSession.mockResolvedValue(session({ phase: 'failed', needsRedirectUrl: false, error: 'nope' }))
    const store = useCredentialsStore()

    await store.start('codex')
    await vi.advanceTimersByTimeAsync(4000)
    expect(mocked.getSession).not.toHaveBeenCalled()
  })

  it('records the error and does not start a session when start fails', async () => {
    mocked.startSession.mockRejectedValue(new Error('worker down'))
    const store = useCredentialsStore()

    await expect(store.start('claude')).rejects.toThrow('worker down')
    expect(store.states.claude.session).toBeNull()
    expect(store.states.claude.error).toBe('worker down')
  })

  it('submitRedirect surfaces a rejected URL and otherwise refreshes', async () => {
    mocked.startSession.mockResolvedValue(session())
    const store = useCredentialsStore()
    await store.start('claude')

    mocked.submitRedirectUrl.mockResolvedValue({ ok: false, error: 'not an absolute http URL' })
    await store.submitRedirect('claude', 'nope')
    expect(store.states.claude.error).toBe('not an absolute http URL')

    mocked.submitRedirectUrl.mockResolvedValue({ ok: true })
    mocked.getSession.mockResolvedValue(session({ phase: 'finalizing', needsRedirectUrl: false }))
    await store.submitRedirect('claude', 'https://claude.ai/oauth/callback?code=2')
    expect(mocked.submitRedirectUrl).toHaveBeenLastCalledWith('s1', 'https://claude.ai/oauth/callback?code=2')
    expect(store.states.claude.session?.phase).toBe('finalizing')
  })

  it('cancel calls the worker and stops polling', async () => {
    mocked.startSession.mockResolvedValue(session())
    const store = useCredentialsStore()
    await store.start('claude')

    mocked.cancelSession.mockResolvedValue({ ok: true })
    mocked.getSession.mockResolvedValue(session({ phase: 'cancelled', needsRedirectUrl: false }))
    await store.cancel('claude')
    expect(mocked.cancelSession).toHaveBeenCalledWith('s1')
    expect(store.states.claude.session?.phase).toBe('cancelled')
  })

  it('fetchStored populates per-provider stored credential status', async () => {
    mocked.getStoredStatus.mockResolvedValue({
      claude: { exists: true, version: 2, updatedAt: '2026-06-23T10:00:00Z', updatedBy: 'ExtraToast' },
      codex: { exists: false, version: 0 },
    })
    const store = useCredentialsStore()

    await store.fetchStored()
    expect(store.stored.claude?.exists).toBe(true)
    expect(store.stored.claude?.updatedBy).toBe('ExtraToast')
    expect(store.stored.codex?.exists).toBe(false)
  })

  it('refreshes the stored-credential check after a login succeeds', async () => {
    mocked.startSession.mockResolvedValue(session())
    mocked.getSession.mockResolvedValue(session({ phase: 'succeeded', needsRedirectUrl: false }))
    mocked.getStoredStatus.mockResolvedValue({
      claude: { exists: true, version: 3 },
      codex: { exists: false, version: 0 },
    })
    const store = useCredentialsStore()

    await store.start('claude')
    await vi.advanceTimersByTimeAsync(2000)
    expect(mocked.getStoredStatus).toHaveBeenCalled()
    expect(store.stored.claude?.version).toBe(3)
  })

  it('reset clears provider state', async () => {
    mocked.startSession.mockResolvedValue(session())
    const store = useCredentialsStore()
    await store.start('claude')
    store.reset('claude')
    expect(store.states.claude.session).toBeNull()
  })
})
