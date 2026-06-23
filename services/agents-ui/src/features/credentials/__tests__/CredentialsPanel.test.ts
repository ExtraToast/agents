import type { CredentialSession } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CredentialsPanel from '../components/CredentialsPanel.vue'
import { useCredentialsStore } from '../stores/credentials'

vi.mock('@/lib/vueWebCommons', () => ({
  Card: { name: 'Card', template: '<section><slot /></section>' },
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useApiWithAuth: () => ({ get: vi.fn(), post: vi.fn() }),
}))

function awaitingUrl(authorizeUrl: string): CredentialSession {
  return { id: 's1', provider: 'claude', phase: 'awaiting_url', needsRedirectUrl: true, authorizeUrl }
}

describe('credentials panel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders one card per provider with a connection pill from stored status', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    store.stored.claude = { exists: true, version: 2, updatedAt: '2026-06-23T10:00:00Z', updatedBy: 'ExtraToast' }
    store.stored.codex = { exists: false, version: 0 }
    await nextTick()

    expect(wrapper.find('[data-testid="credentials-card-claude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-card-codex"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-pill-claude"]').text()).toContain('Connected')
    expect(wrapper.find('[data-testid="credentials-pill-codex"]').text()).toContain('Not connected')
    expect(wrapper.find('[data-testid="credentials-check-claude"]').text()).toContain('ExtraToast')
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

  it('renders the success confirmation once a login succeeds', async () => {
    const wrapper = mount(CredentialsPanel)
    const store = useCredentialsStore()
    store.states.claude.session = { id: 's1', provider: 'claude', phase: 'succeeded', needsRedirectUrl: false }
    await nextTick()

    expect(wrapper.find('[data-testid="credentials-success-claude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-success-claude"]').text()).toContain('saved to Vault')
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
