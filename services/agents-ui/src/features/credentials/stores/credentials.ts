import type { CredentialProvider, CredentialSession, CredentialStatus } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cancelSession, getSession, getStoredStatus, startSession, submitRedirectUrl } from '../services/credentialsService'
import { isTerminalPhase } from '../types'

const POLL_INTERVAL_MS = 2000

interface ProviderState {
  session: CredentialSession | null
  submittedRedirectSessionId: string | null
  busy: boolean
  error: string | null
  timer: ReturnType<typeof setInterval> | null
}

function emptyState(): ProviderState {
  return { session: null, submittedRedirectSessionId: null, busy: false, error: null, timer: null }
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const { message } = value
    if (typeof message === 'string') return message
  }
  return ''
}

function errorStatus(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && 'status' in value) {
    const { status } = value
    if (typeof status === 'number') return status
  }
  return null
}

function isAlreadySubmittedError(value: unknown): boolean {
  return errorMessage(value).toLowerCase().includes('authorization code already submitted')
}

export const useCredentialsStore = defineStore('credentials', () => {
  // One independent flow per provider so the two cards don't share state.
  const states = ref<Record<CredentialProvider, ProviderState>>({
    claude: emptyState(),
    codex: emptyState(),
  })

  // The "check": what is currently stored per provider, independent of any
  // active login. Refreshed on mount and after a login succeeds.
  const stored = ref<Record<CredentialProvider, CredentialStatus | null>>({
    claude: null,
    codex: null,
  })

  async function fetchStored(): Promise<void> {
    try {
      const status = await getStoredStatus()
      stored.value.claude = status.claude
      stored.value.codex = status.codex
    } catch {
      // Non-fatal: the check is best-effort and must not block a login.
    }
  }

  function stopPolling(provider: CredentialProvider): void {
    const state = states.value[provider]
    if (state.timer !== null) {
      clearInterval(state.timer)
      state.timer = null
    }
  }

  function startPolling(provider: CredentialProvider): void {
    stopPolling(provider)
    states.value[provider].timer = setInterval(() => {
      void poll(provider)
    }, POLL_INTERVAL_MS)
  }

  async function poll(provider: CredentialProvider): Promise<void> {
    const state = states.value[provider]
    const id = state.session?.id
    if (id === undefined) return
    try {
      const session = await getSession(id)
      state.session = session
      if (isTerminalPhase(session.phase)) {
        stopPolling(provider)
        // A completed login changes what is stored — refresh the check so the
        // card confirms the new credentials landed.
        if (session.phase === 'succeeded') await fetchStored()
      }
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to refresh session'
      stopPolling(provider)
    }
  }

  async function start(provider: CredentialProvider): Promise<void> {
    const state = states.value[provider]
    state.busy = true
    state.error = null
    try {
      state.session = await startSession(provider)
      state.submittedRedirectSessionId = null
      if (!isTerminalPhase(state.session.phase)) startPolling(provider)
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to start session'
      throw e
    } finally {
      state.busy = false
    }
  }

  async function submitRedirect(provider: CredentialProvider, url: string): Promise<void> {
    const state = states.value[provider]
    const id = state.session?.id
    if (id === undefined) return
    state.busy = true
    state.error = null
    try {
      if (state.submittedRedirectSessionId === id) {
        await poll(provider)
        return
      }
      state.submittedRedirectSessionId = id
      const result = await submitRedirectUrl(id, url)
      if (!result.ok) {
        if (isAlreadySubmittedError(result.error)) {
          await poll(provider)
          return
        }
        state.submittedRedirectSessionId = null
        state.error = result.error ?? 'Redirect URL was rejected'
        return
      }
      // Refresh immediately; the worker stays in awaiting_url until the
      // CLI emits its success line, which the poll will pick up.
      await poll(provider)
    } catch (e) {
      const status = errorStatus(e)
      const isSubmittedClientError = state.submittedRedirectSessionId === id && status !== null && status >= 400 && status < 500
      if (isAlreadySubmittedError(e) || isSubmittedClientError) {
        state.submittedRedirectSessionId = id
        await poll(provider)
        return
      }
      state.error = e instanceof Error ? e.message : 'Failed to submit redirect URL'
      throw e
    } finally {
      state.busy = false
    }
  }

  async function cancel(provider: CredentialProvider): Promise<void> {
    const state = states.value[provider]
    const id = state.session?.id
    if (id === undefined) return
    state.busy = true
    try {
      await cancelSession(id)
      await poll(provider)
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to cancel session'
    } finally {
      stopPolling(provider)
      state.busy = false
    }
  }

  function reset(provider: CredentialProvider): void {
    stopPolling(provider)
    states.value[provider] = emptyState()
  }

  function dispose(): void {
    stopPolling('claude')
    stopPolling('codex')
  }

  return { states, stored, fetchStored, start, submitRedirect, cancel, reset, dispose, poll }
})
