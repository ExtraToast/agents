import type { CredentialSession } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CredentialsPanel from '../components/CredentialsPanel.vue'
import { useCredentialsStore } from '../stores/credentials'

const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/lib/vueWebCommons', () => ({
  Card: { name: 'Card', template: '<section><slot /></section>' },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useApiWithAuth: () => ({ get: apiGet, post: vi.fn() }),
}))

function awaitingUrl(authorizeUrl: string): CredentialSession {
  return { id: 's1', provider: 'claude', phase: 'awaiting_url', needsRedirectUrl: true, authorizeUrl }
}

describe('credentials panel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiGet.mockReset()
    apiGet.mockResolvedValue({
      claude: { exists: false, valid: null },
      codex: { exists: false, valid: null },
    })
  })

  it('renders one card per provider with a connection pill only for connected providers', async () => {
    apiGet.mockResolvedValue({
      claude: { exists: true, valid: true, updatedAt: '2026-06-23T10:00:00Z', updatedBy: 'ExtraToast' },
      codex: { exists: false, valid: null },
    })
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    await store.fetchStored()

    expect(wrapper.find('[data-testid="credentials-card-claude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-card-codex"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-icon-claude"]').attributes('alt')).toBe('Claude Code icon')
    expect(wrapper.find('[data-testid="credentials-icon-codex"]').attributes('aria-label')).toBe('Codex product icon')
    expect(wrapper.find('[data-testid="credentials-pill-claude"]').text()).toContain('Connected')
    expect(wrapper.find('[data-testid="credentials-check-claude"]').text()).toContain('ExtraToast')
  })

  it('shows no status pill or detail line for an unconnected provider', async () => {
    // The loud "Not connected / No credentials stored yet" badge was noise —
    // an unconnected provider already reads as such from its sign-in button.
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    await store.fetchStored()

    expect(wrapper.find('[data-testid="credentials-pill-claude"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="credentials-check-claude"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="credentials-pill-codex"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="credentials-start-claude"]').text()).toContain('Sign in to Claude Code')
  })

  it('refreshes stored credential status on mount', async () => {
    mount(CredentialsPanel)

    await nextTick()
    expect(apiGet).toHaveBeenCalledWith('/credentials/status')
  })

  it('distinguishes unvalidated credentials from credentials that need re-login', async () => {
    apiGet.mockResolvedValue({
      claude: { exists: true, valid: null },
      codex: { exists: true, valid: false, updatedAt: '2026-06-23T10:00:00Z' },
    })
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    await store.fetchStored()

    expect(wrapper.find('[data-testid="credentials-pill-claude"]').text()).toContain('Stored')
    expect(wrapper.find('[data-testid="credentials-check-claude"]').text()).toContain('Stored, not verified')
    expect(wrapper.find('[data-testid="credentials-pill-codex"]').text()).toContain('Re-login needed')
    expect(wrapper.find('[data-testid="credentials-check-codex"]').text()).toContain('Sign in again')
  })

  it('exposes the authorize URL only as a sign-in link button, never as raw text', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    const url = 'https://claude.com/cai/oauth/authorize?code=true&state=realstatevalue'
    store.states.claude.session = awaitingUrl(url)
    await nextTick()

    const link = wrapper.find('[data-testid="credentials-open-claude"]')
    expect(link.exists()).toBe(true)
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe(url)
    expect(link.attributes('target')).toBe('_blank')
    // The URL must not be printed for copying — only navigable via the button.
    expect(wrapper.find('[data-testid="credentials-code-input-claude"]').exists()).toBe(true)
    expect(wrapper.find('input[data-testid="credentials-code-input-claude"]').element.tagName).toBe('INPUT')
  })

  it('does not show the stored-status pill inside an active sign-in flow', async () => {
    apiGet.mockResolvedValue({
      claude: { exists: true, valid: true, updatedAt: '2026-06-23T10:00:00Z', updatedBy: 'ExtraToast' },
      codex: { exists: true, valid: true, updatedAt: '2026-06-23T10:00:00Z', updatedBy: 'ExtraToast' },
    })
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    await store.fetchStored()
    store.states.claude.session = awaitingUrl('https://claude.com/cai/oauth/authorize')
    await nextTick()

    // Claude is mid-flow, so its connected pill is suppressed; Codex (idle and
    // connected) still shows its pill.
    expect(wrapper.find('[data-testid="credentials-pill-claude"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="credentials-pill-codex"]').exists()).toBe(true)
  })

  it('submits the pasted code on Enter without a dedicated button press', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    const submitRedirect = vi.spyOn(store, 'submitRedirect').mockResolvedValue()
    store.states.claude.session = awaitingUrl('https://claude.com/cai/oauth/authorize')
    await nextTick()

    const input = wrapper.find('[data-testid="credentials-code-input-claude"]')
    await input.setValue('  auth-code-123  ')
    await input.trigger('keyup.enter')

    expect(submitRedirect).toHaveBeenCalledWith('claude', 'auth-code-123')
  })

  it('renders the success confirmation once a login succeeds', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    store.states.claude.session = { id: 's1', provider: 'claude', phase: 'succeeded', needsRedirectUrl: false }
    await nextTick()

    expect(wrapper.find('[data-testid="credentials-success-claude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-success-claude"]').text()).toContain('credentials saved')
  })

  it('shows the Codex device code and an open-device-page link', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    store.states.codex.session = {
      id: 's2',
      provider: 'codex',
      phase: 'awaiting_device',
      needsRedirectUrl: false,
      deviceCode: 'WXYZ-1234',
      verificationUrl: 'https://auth.openai.com/device',
    }
    await nextTick()

    expect(wrapper.find('[data-testid="credentials-device-code-codex"]').text()).toContain('WXYZ-1234')
    const link = wrapper.find('[data-testid="credentials-open-codex"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('https://auth.openai.com/device')
  })
})
