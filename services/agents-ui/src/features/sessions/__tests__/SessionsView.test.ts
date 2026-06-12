import type { AppShellNavItem } from '@/lib/vueWebCommons'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import packageJson from '../../../../package.json'
import AppShell from '../../../layouts/AppShell.vue'
import SessionsView from '../views/SessionsView.vue'

vi.mock('../components/ChatTab.vue', () => ({
  default: { name: 'ChatTab', template: '<div data-testid="chat-tab-stub">Chat panel</div>' },
}))

vi.mock('../components/ScratchTab.vue', () => ({
  default: { name: 'ScratchTab', template: '<div data-testid="scratch-tab-stub">Scratch panel</div>' },
}))

vi.mock('../components/WorkspaceTab.vue', () => ({
  default: { name: 'WorkspaceTab', template: '<div data-testid="workspace-tab-stub">Workspace panel</div>' },
}))

vi.mock('@/lib/vueWebCommons', async () => {
  const { computed, defineComponent, h, inject, provide } = await import('vue')
  const activeKey = Symbol('active-tab')

  return {
    agentsThemeOptions: { storageKey: 'agents_theme' },
    AppShell: defineComponent({
      name: 'CommonsAppShell',
      props: {
        brandMain: String,
        layout: String,
        navItems: Array,
        newActionLabel: String,
        newActionTo: String,
        themeOptions: Object,
      },
      setup(_props, { slots }) {
        return () => h('div', { 'data-testid': 'commons-app-shell' }, slots.default?.())
      },
    }),
    Tabs: defineComponent({
      name: 'Tabs',
      props: {
        modelValue: { type: String, default: '' },
        ariaLabel: { type: String, default: '' },
      },
      emits: ['update:modelValue'],
      setup(props, { emit, slots }) {
        const active = computed({
          get: () => props.modelValue,
          set: (value: string) => emit('update:modelValue', value),
        })
        provide(activeKey, active)
        return () =>
          h('div', { 'data-testid': 'tabs' }, [
            h(
              'div',
              { 'role': 'tablist', 'aria-label': props.ariaLabel },
              slots.tabs?.({ active: active.value, activate: (value: string) => emit('update:modelValue', value) }),
            ),
            slots.default?.(),
          ])
      },
    }),
    TabPanel: defineComponent({
      name: 'TabPanel',
      props: {
        value: { type: String, required: true },
        keepAlive: { type: Boolean, default: false },
      },
      setup(props, { slots }) {
        const active = inject<{ value: string }>(activeKey)
        return () => {
          const selected = active?.value === props.value
          if (!props.keepAlive && !selected) return null
          return h('section', { 'data-testid': `tab-panel-${props.value}`, 'hidden': !selected }, slots.default?.())
        }
      },
    }),
  }
})

async function mountSessions(path = '/sessions') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/sessions', component: SessionsView }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(SessionsView, {
    global: {
      plugins: [router],
    },
  })
  return { router, wrapper }
}

describe('sessions home', () => {
  it('uses the published rail-capable commons package range', () => {
    expect(packageJson.dependencies['@extratoast/vue-web-commons']).toBe('^0.3.0')
  })

  it('passes rail layout, nav icons, session child links, and the new session action to AppShell', () => {
    const wrapper = mount(AppShell, {
      slots: { default: '<main data-testid="shell-slot" />' },
    })

    const shell = wrapper.getComponent({ name: 'CommonsAppShell' })
    const navItems: AppShellNavItem[] = shell.props('navItems')
    const sessions = navItems[0]

    expect(shell.props('layout')).toBe('rail')
    expect(shell.props('newActionLabel')).toBe('New session')
    expect(shell.props('newActionTo')).toBe('/sessions?tab=workspace&new=1')
    expect(navItems.map((item) => item.icon)).toEqual(['terminal', 'folder', 'git'])
    expect(sessions?.children?.map((item) => [item.label, item.to, item.icon])).toEqual([
      ['Workspace', '/sessions?tab=workspace', 'window'],
      ['Scratch', '/sessions?tab=scratch', 'terminal'],
      ['Chat', '/sessions?tab=chat', 'chat'],
    ])
  })

  it('defaults to a workspace-first, left-aligned home', async () => {
    const { wrapper } = await mountSessions()

    expect(wrapper.classes()).toContain('max-w-6xl')
    expect(wrapper.classes()).toContain('p-6')
    expect(wrapper.classes()).not.toContain('mx-auto')
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Workspace', 'Scratch', 'Chat'])
    expect(wrapper.get('[data-testid="sessions-tab-workspace"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('[data-testid="workspace-tab-stub"]').exists()).toBe(true)
  })

  it('reads and writes the active tab from the route query', async () => {
    const { router, wrapper } = await mountSessions('/sessions?tab=scratch')

    expect(wrapper.get('[data-testid="sessions-tab-scratch"]').attributes('aria-selected')).toBe('true')

    await wrapper.get('[data-testid="sessions-tab-chat"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ tab: 'chat' })
    expect(wrapper.get('[data-testid="sessions-tab-chat"]').attributes('aria-selected')).toBe('true')
  })
})
