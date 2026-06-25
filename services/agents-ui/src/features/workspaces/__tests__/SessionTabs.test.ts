import type { AgentSession } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SessionTabs from '../components/SessionTabs.vue'
import { useSessionLabelsStore } from '../stores/sessionLabels'

function expectSvgIcon(src: string | undefined, title: string): void {
  expect(src).toMatch(/^data:image\/svg\+xml/)
  expect(decodeURIComponent(src ?? '')).toContain(`<title>${title}</title>`)
}

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

  it('selects the text once on open but not again on every keystroke while renaming', async () => {
    const labels = useSessionLabelsStore()
    labels.rename('aaaaaaaa-1111-2222-3333-444444444444', 'name')
    const session = fakeSession()
    // Spy on the prototype so the initial focus-time select() is counted too,
    // and attach to the document so the input can actually take focus (the fix
    // skips re-selecting once the input is already the active element).
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select')
    const wrapper = mount(SessionTabs, {
      attachTo: document.body,
      props: { sessions: [session], activeId: null },
    })
    await wrapper.get(`[data-testid="session-tab-${session.id}"]`).trigger('contextmenu')
    await nextTick()

    // Opening the editor selects the whole label so it can be replaced.
    expect(selectSpy).toHaveBeenCalledTimes(1)

    // Each keystroke re-renders the input via v-model, re-firing the focus ref.
    // It must not reselect the text, otherwise the next character would
    // overwrite the whole field.
    await wrapper.find('[data-testid="session-tab-rename"]').setValue('named')
    await nextTick()
    await wrapper.find('[data-testid="session-tab-rename"]').setValue('named-tab')
    await nextTick()
    expect(selectSpy).toHaveBeenCalledTimes(1)

    selectSpy.mockRestore()
    wrapper.unmount()
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

    const rename = wrapper.get(`[data-testid="session-tab-rename-${session.id}"]`)
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

  it('shows a kind icon and status on the tab', () => {
    const unknownSession = fakeSession({ id: 'sess-unknown', status: 'RUNNING' })
    Object.defineProperty(unknownSession, 'kind', { value: 'MYSTERY' })

    const sessions = [
      fakeSession({ id: 'sess-codex', kind: 'CODEX', status: 'RUNNING' }),
      fakeSession({ id: 'sess-starting', kind: 'SHELL', status: 'STARTING' }),
      unknownSession,
    ] satisfies AgentSession[]

    const wrapper = mount(SessionTabs, {
      props: {
        sessions,
        activeId: null,
      },
    })
    const codexKind = wrapper.get('[data-testid="session-tab-kind-sess-codex"]')
    const shellTab = wrapper.get('[data-testid="session-tab-sess-starting"]')
    const shellKind = shellTab.get('[data-testid="session-tab-kind-sess-starting"]')
    const unknownKind = wrapper.get('[data-testid="session-tab-kind-sess-unknown"]')

    expect(codexKind.attributes('data-kind')).toBe('CODEX')
    expectSvgIcon(codexKind.get('img').attributes('src'), 'Codex')
    expect(codexKind.get('img').attributes('aria-hidden')).toBe('true')
    expect(shellKind.attributes('data-kind')).toBe('SHELL')
    expect(shellKind.attributes('aria-label')).toBe('Shell')
    expect(shellKind.find('img').exists()).toBe(false)
    expect(unknownKind.attributes('aria-label')).toBe('Unknown')
    expect(unknownKind.find('img').exists()).toBe(false)
    expect(shellTab.find('[aria-label="Status: STARTING"]').exists()).toBe(true)
  })

  it('defaults the tab name to kind-index (claude-1) and exposes a rename control', () => {
    const wrapper = mount(SessionTabs, {
      props: { sessions: [fakeSession({ id: 'sess-c' })], activeId: null },
    })

    expect(wrapper.get('[data-testid="session-tab-sess-c"]').text()).toContain('claude-1')
    expect(wrapper.find('[data-testid="session-tab-rename-sess-c"]').exists()).toBe(true)
  })

  it('deletes a session via the × control beside the tab', async () => {
    const session = fakeSession({ id: 'sess-del', status: 'STOPPED' })
    const wrapper = mount(SessionTabs, {
      props: { sessions: [session], activeId: null },
    })

    await wrapper.get('[data-testid="session-tab-delete-sess-del"]').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['sess-del']])
  })
})
