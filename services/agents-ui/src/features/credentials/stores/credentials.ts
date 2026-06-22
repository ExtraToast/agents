import type { CredentialProvider, CredentialSession } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cancelSession, getSession, startSession, submitRedirectUrl } from '../services/credentialsService'
import { isTerminalPhase } from '../types'

const POLL_INTERVAL_MS = 2000

interface ProviderState {
  session: CredentialSession | null
  busy: boolean
  error: string | null
  timer: ReturnType<typeof setInterval> | null
}

function emptyState(): ProviderState {
  return { session: null, busy: false, error: null, timer: null }
}

export const useCredentialsStore = defineStore('credentials', () => {
  // One independent flow per provider so the two cards don't share state.
  const states = ref<Record<CredentialProvider, ProviderState>>({
    claude: emptyState(),
    codex: emptyState(),
  })

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
      if (isTerminalPhase(session.phase)) stopPolling(provider)
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
      const result = await submitRedirectUrl(id, url)
      if (!result.ok) {
        state.error = result.error ?? 'Redirect URL was rejected'
        return
      }
      // Refresh immediately; the worker stays in awaiting_url until the
      // CLI emits its success line, which the poll will pick up.
      await poll(provider)
    } catch (e) {
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

  return { states, start, submitRedirect, cancel, reset, dispose, poll }
})
