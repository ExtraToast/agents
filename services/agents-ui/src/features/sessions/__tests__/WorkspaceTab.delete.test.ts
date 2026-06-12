import type { Workspace } from '@/features/workspaces'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useWorkspacesStore } from '@/features/workspaces'
import WorkspaceTab from '../components/WorkspaceTab.vue'

vi.mock('@/lib/vueWebCommons', async () => {
  const { defineComponent, h, ref } = await import('vue')

  return {
    Card: defineComponent({
      name: 'Card',
      setup(_props, { attrs, slots }) {
        return () => h('a', attrs, [slots.header?.(), slots.default?.()])
      },
    }),
    Modal: defineComponent({
      name: 'Modal',
      props: {
        open: { type: Boolean, required: true },
        title: { type: String, required: true },
      },
      setup(props, { slots }) {
        return () => (props.open ? h('div', { 'data-testid': 'modal' }, slots.default?.()) : null)
      },
    }),
    SubmitButton: defineComponent({
      name: 'SubmitButton',
      props: {
        label: { type: String, required: true },
        status: String,
        type: String,
        variant: String,
      },
      emits: ['click'],
      setup(props, { attrs, emit }) {
        return () =>
          h(
            'button',
            {
              ...attrs,
              type: props.type ?? 'button',
              onClick: (event: MouseEvent) => emit('click', event),
            },
            props.label,
          )
      },
    }),
    useMutationState: () => {
      const status = ref('idle')
      return {
        status,
        async run(fn: () => Promise<void>) {
          status.value = 'loading'
          try {
            await fn()
          } finally {
            status.value = 'idle'
          }
        },
      }
    },
    useToast: () => ({
      success: () => {},
      errorFromCatch: () => {},
    }),
  }
})

function repoBackedWorkspace(id: string, name: string): Workspace {
  const now = new Date().toISOString()
  return {
    id,
    name,
    repoUrl: 'git@github.com:ExtraToast/demo.git',
    branch: 'main',
    podName: null,
    gatewayEndpoint: null,
    status: 'READY',
    kind: 'REPO_BACKED',
    projectId: null,
    repositoryId: 'r1',
    githubLinkId: null,
    createdAt: now,
    updatedAt: now,
  }
}

async function mountTab(path = '/sessions') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(WorkspaceTab, {
    global: {
      plugins: [router],
      stubs: { CreateWorkspaceWizard: true },
    },
  })
  return { router, wrapper }
}

describe('workspace tab delete', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes a workspace through the store after the user confirms', async () => {
    const store = useWorkspacesStore()
    store.loadAll = vi.fn().mockResolvedValue(undefined)
    store.destroy = vi.fn().mockResolvedValue(undefined)
    store.workspaces = [repoBackedWorkspace('w1', 'demo')]
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { wrapper } = await mountTab()
    await wrapper.get('[data-testid="workspace-delete-w1"]').trigger('click')

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(store.destroy).toHaveBeenCalledWith('w1')
  })

  it('does not delete when the user cancels the confirm', async () => {
    const store = useWorkspacesStore()
    store.loadAll = vi.fn().mockResolvedValue(undefined)
    store.destroy = vi.fn().mockResolvedValue(undefined)
    store.workspaces = [repoBackedWorkspace('w1', 'demo')]
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { wrapper } = await mountTab()
    await wrapper.get('[data-testid="workspace-delete-w1"]').trigger('click')

    expect(store.destroy).not.toHaveBeenCalled()
  })

  it('opens the creation wizard once from the route query and clears the flag', async () => {
    const store = useWorkspacesStore()
    store.loadAll = vi.fn().mockResolvedValue(undefined)
    store.workspaces = []

    const { router, wrapper } = await mountTab('/sessions?tab=workspace&new=1')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'CreateWorkspaceWizard' }).props('open')).toBe(true)
    expect(router.currentRoute.value.query).toEqual({ tab: 'workspace' })
  })
})
