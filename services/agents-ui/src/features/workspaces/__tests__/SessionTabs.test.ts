import type { AgentSession } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import SessionTabs from '../components/SessionTabs.vue'
import { useSessionLabelsStore } from '../stores/sessionLabels'

function fakeSession(over: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    workspaceId: 'ws-1',
    kind: 'CLAUDE',
    gatewayAgentId: 'g1',
    status: 'RUNNING',
    createdAt: '2026-06-03T10:00:00Z',
    updatedAt: '2026-06-03T10:00:00Z',
    ...over,
  }
}

describe('sessionTabs', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows the 8-char id by default and a custom label when one is set', () => {
    const labels = useSessionLabelsStore()
    labels.rename('aaaaaaaa-1111-2222-3333-444444444444', 'API tab')
    const wrapper = mount(SessionTabs, {
      props: { sessions: [fakeSession()], activeId: null },
    })
    expect(wrapper.text()).toContain('API tab')
    expect(wrapper.text()).not.toContain('aaaaaaaa')
  })

  it('right-click opens an inline editor; Enter commits and persists the label', async () => {
    const session = fakeSession()
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: null },
    })
    expect(wrapper.find('[data-testid="session-tab-rename"]').exists()).toBe(false)

    await wrapper.get(`[data-testid="session-tab-${session.id}"]`).trigger('contextmenu')
    const input = wrapper.find('[data-testid="session-tab-rename"]')
    expect(input.exists()).toBe(true)

    await input.setValue('renamed')
    await input.trigger('keydown.enter')

    expect(useSessionLabelsStore().labelFor('aaaaaaaa-1111-2222-3333-444444444444')).toBe('renamed')
    expect(wrapper.find('[data-testid="session-tab-rename"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('renamed')
  })

  it('escape cancels the edit without changing the label', async () => {
    const labels = useSessionLabelsStore()
    labels.rename('aaaaaaaa-1111-2222-3333-444444444444', 'original')
    const session = fakeSession()
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: null },
    })
    await wrapper.get(`[data-testid="session-tab-${session.id}"]`).trigger('contextmenu')
    const input = wrapper.find('[data-testid="session-tab-rename"]')
    await input.setValue('discarded')
    await input.trigger('keydown.esc')

    expect(labels.labelFor('aaaaaaaa-1111-2222-3333-444444444444')).toBe('original')
    expect(wrapper.text()).toContain('original')
  })

  it('does not emit select while typing in the rename input', async () => {
    const session = fakeSession()
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: null },
    })
    await wrapper.get(`[data-testid="session-tab-${session.id}"]`).trigger('contextmenu')
    await wrapper.find('[data-testid="session-tab-rename"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('renders accessible tab semantics with selected state and controlled panel ids', () => {
    const sessions = [
      fakeSession({ id: 'sess-a', kind: 'CLAUDE', status: 'RUNNING' }),
      fakeSession({ id: 'sess-b', kind: 'CODEX', status: 'STOPPED' }),
    ]
    const wrapper = mount(SessionTabs, {
      props: { sessions, activeId: 'sess-b', orientation: 'vertical' },
    })

    const tabs = wrapper.findAll('[role="tab"]')
    expect(wrapper.get('[data-testid="session-tabs-list"]').attributes('role')).toBe('tablist')
    expect(wrapper.get('[data-testid="session-tabs-list"]').attributes('aria-orientation')).toBe('vertical')
    expect(tabs).toHaveLength(2)
    expect(tabs.every((tab) => tab.element.tagName === 'DIV')).toBe(true)
    expect(wrapper.get('[data-testid="session-tab-sess-a"]').attributes()).toMatchObject({
      'role': 'tab',
      'aria-selected': 'false',
      'aria-controls': 'session-panel-sess-a',
      'tabindex': '-1',
    })
    expect(wrapper.get('[data-testid="session-tab-sess-b"]').attributes()).toMatchObject({
      'role': 'tab',
      'aria-selected': 'true',
      'aria-controls': 'session-panel-sess-b',
      'tabindex': '0',
    })
  })

  it('supports roving tabindex with arrow, Home, and End keyboard navigation', async () => {
    const sessions = [
      fakeSession({ id: 'sess-a' }),
      fakeSession({ id: 'sess-b' }),
      fakeSession({ id: 'sess-c' }),
    ]
    const wrapper = mount(SessionTabs, {
      attachTo: document.body,
      props: { sessions, activeId: 'sess-a' },
    })

    await wrapper.get('[data-testid="session-tab-sess-a"]').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['sess-b']])
    expect(wrapper.get('[data-testid="session-tab-sess-a"]').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('[data-testid="session-tab-sess-b"]').attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="session-tab-sess-b"]').element)

    await wrapper.get('[data-testid="session-tab-sess-b"]').trigger('keydown', { key: 'End' })
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['sess-b'], ['sess-c']])
    expect(wrapper.get('[data-testid="session-tab-sess-c"]').attributes('tabindex')).toBe('0')

    await wrapper.get('[data-testid="session-tab-sess-c"]').trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['sess-b'], ['sess-c'], ['sess-a']])
    expect(wrapper.get('[data-testid="session-tab-sess-a"]').attributes('tabindex')).toBe('0')

    await wrapper.get('[data-testid="session-tab-sess-a"]').trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['sess-b'], ['sess-c'], ['sess-a'], ['sess-c']])
    expect(wrapper.get('[data-testid="session-tab-sess-c"]').attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('selects a tab on click and carries no stop control (stop lives in the controls pane)', async () => {
    const session = fakeSession()
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: session.id, orientation: 'horizontal' },
    })

    await wrapper.get(`[data-testid="session-tab-${session.id}"]`).trigger('click')

    expect(wrapper.get('[data-testid="session-tabs"]').attributes('aria-label')).toBe('Agent sessions')
    expect(wrapper.find(`[data-testid="session-tab-stop-${session.id}"]`).exists()).toBe(false)
    expect(wrapper.emitted('select')).toEqual([[session.id]])
  })

  it('shows a click rename affordance and opens the inline editor from it', async () => {
    const session = fakeSession()
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: null },
    })

    const rename = wrapper.get(`button[aria-label="Rename session ${session.id.slice(0, 8)}"]`)
    expect(rename.isVisible()).toBe(true)
    await rename.trigger('click')

    expect(wrapper.find('[data-testid="session-tab-rename"]').exists()).toBe(true)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('keeps horizontal session tabs scrollable with stable tab widths', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => fakeSession({ id: `session-${String(i).padStart(2, '0')}` }))
    const wrapper = mount(SessionTabs, {
      props: { sessions, activeId: sessions[0]?.id ?? null },
    })

    expect(wrapper.get('[data-testid="session-tabs-list"]').classes()).toContain('overflow-x-auto')
    expect(wrapper.findAll('li').every((li) => li.classes().includes('shrink-0'))).toBe(true)
  })

  it('renders retained stopped and failed sessions without stop controls', () => {
    const sessions = [
      fakeSession({ id: 'sess-stopped', status: 'STOPPED' }),
      fakeSession({ id: 'sess-failed', status: 'FAILED' }),
    ]
    const wrapper = mount(SessionTabs, {
      props: { sessions, activeId: 'sess-stopped' },
    })

    expect(wrapper.find('[data-testid="session-tab-sess-stopped"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-tab-sess-failed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-tab-stop-sess-stopped"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="session-tab-stop-sess-failed"]').exists()).toBe(false)
  })

  it('exposes kind and status through an accessible status dot', () => {
    const wrapper = mount(SessionTabs, {
      props: { sessions: [fakeSession({ id: 'sess-starting', kind: 'SHELL', status: 'STARTING' })], activeId: null },
    })
    const tab = wrapper.get('[data-testid="session-tab-sess-starting"]')

    expect(tab.get('[aria-label="SHELL, STARTING"]').exists()).toBe(true)
  })

  it('surfaces current and pending setup through the tab label tooltip', () => {
    const wrapper = mount(SessionTabs, {
      props: {
        sessions: [
          fakeSession({
            id: 'sess-setup',
            currentSetup: { id: 'setup-current', version: 1 },
            pendingSetup: { id: 'setup-next', version: 2 },
          }),
        ],
        activeId: 'sess-setup',
      },
    })

    expect(wrapper.get('[data-testid="session-tab-label-sess-setup"]').attributes('title')).toBe(
      'setup-current@v1 -> setup-next@v2',
    )
  })
})
