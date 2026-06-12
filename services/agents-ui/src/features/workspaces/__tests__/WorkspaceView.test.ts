import type { AgentSession, WorkspaceDetail, WorkspaceRepository } from '../types'
import type { Repository } from '@/features/repositories'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useWorkspacesStore } from '../stores/workspaces'
import WorkspaceView from '../views/WorkspaceView.vue'

// xterm + the WebSocket wrapper touch real DOM/network the same way
// SessionTerminal.test.ts stubs them. Reuse the same fakes here so the
// view mounts real SessionTerminal children and the mount/dispose
// lifecycle can be asserted across tab switches.
const term = {
  write: vi.fn(),
  loadAddon: vi.fn(),
  open: vi.fn(),
  onData: vi.fn(),
  onResize: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
}
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    write = term.write
    loadAddon = term.loadAddon
    open = term.open
    onData = term.onData
    onResize = term.onResize
    focus = term.focus
    dispose = term.dispose
  },
}))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  },
}))

const socket = {
  send: vi.fn(),
  sendKey: vi.fn(),
  sendResize: vi.fn(),
  setReconnect: vi.fn(),
  reconnectNow: vi.fn(),
  close: vi.fn(),
  readyState: vi.fn(() => 1),
}
const attachSessionSocket = vi.fn(() => socket)
vi.mock('../services/sessionSocket', () => ({
  attachSessionSocket: () => attachSessionSocket(),
}))

const statusStream = {
  close: vi.fn(),
  readyState: vi.fn(() => 1),
}
let statusStreamOptions: { onOpen?: () => void; onError?: () => void } | null = null
const openSessionStatusStream = vi.fn((opts: { onOpen?: () => void; onError?: () => void }) => {
  statusStreamOptions = opts
  return statusStream
})
vi.mock('../services/sessionStatusStream', () => ({
  openSessionStatusStream: (opts: { onOpen?: () => void; onError?: () => void }) => openSessionStatusStream(opts),
}))

const getWorkspace = vi.fn<(id: string) => Promise<WorkspaceDetail>>()
const attachRepository = vi.fn()
const detachRepository = vi.fn()
const startSession = vi.fn()
const stopSession = vi.fn()
const sendInput = vi.fn()
const stageInput = vi.fn()
const restartSession = vi.fn()
vi.mock('../services/workspaceService', () => ({
  listWorkspaces: vi.fn(),
  getWorkspace: (id: string) => getWorkspace(id),
  createWorkspace: vi.fn(),
  destroyWorkspace: vi.fn(),
  startSession: (...args: unknown[]) => startSession(...args),
  stopSession: (...args: unknown[]) => stopSession(...args),
  restartSession: (...args: unknown[]) => restartSession(...args),
  attachRepository: (...args: unknown[]) => attachRepository(...args),
  detachRepository: (...args: unknown[]) => detachRepository(...args),
  getTurns: vi.fn(async () => []),
  sendInput: (...args: unknown[]) => sendInput(...args),
  stageInput: (...args: unknown[]) => stageInput(...args),
}))

const listRepositories = vi.fn<() => Promise<Repository[]>>()
vi.mock('@/features/repositories/services/repositoriesService', () => ({
  listRepositories: () => listRepositories(),
  getRepository: vi.fn(),
  createRepository: vi.fn(),
  attachDeployKey: vi.fn(),
  deleteRepository: vi.fn(),
  verifyRepositoryAccess: vi.fn(),
}))

function fakeSession(over: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'sess-a',
    workspaceId: 'ws-1',
    kind: 'CLAUDE',
    gatewayAgentId: null,
    status: 'RUNNING',
    createdAt: '2026-05-19T10:00:00Z',
    updatedAt: '2026-05-19T10:00:00Z',
    ...over,
  }
}

function fakeRepository(over: Partial<Repository> = {}): Repository {
  return {
    id: 'repo-primary',
    name: 'primary',
    repoUrl: 'git@github.com:owner/primary.git',
    defaultBranch: 'main',
    vaultKeyPath: 'secret/data/agents/repositories/repo-primary',
    deployKeyFingerprint: 'SHA256:primary',
    deployKeyAddedAt: '2026-05-19T10:00:00Z',
    createdAt: '2026-05-19T10:00:00Z',
    updatedAt: '2026-05-19T10:00:00Z',
    ...over,
  }
}

function fakeWorkspaceRepository(over: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  const repo = fakeRepository(over)
  return {
    ...repo,
    verification: null,
    isPrimary: false,
    attachedAt: '2026-05-20T10:00:00Z',
    ...over,
  }
}

function detail(sessions: AgentSession[], workspace: Partial<WorkspaceDetail['workspace']> = {}): WorkspaceDetail {
  return {
    workspace: {
      id: 'ws-1',
      name: 'demo',
      repoUrl: null,
      branch: null,
      podName: null,
      gatewayEndpoint: null,
      status: 'READY',
      kind: 'REPO_BACKED',
      projectId: null,
      repositoryId: null,
      githubLinkId: null,
      createdAt: '2026-05-19T10:00:00Z',
      updatedAt: '2026-05-19T10:00:00Z',
      repositories: [],
      ...workspace,
    },
    sessions,
  }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/sessions', component: { template: '<div />' } },
    { path: '/repositories', component: { template: '<div />' } },
    { path: '/repositories/:id', component: { template: '<div />' } },
    { path: '/workspaces/:id', component: WorkspaceView },
  ],
})

async function mountView() {
  await router.push('/workspaces/ws-1')
  await router.isReady()
  const wrapper = mount(WorkspaceView, {
    attachTo: document.body,
    global: {
      plugins: [router],
    },
  })
  await flush()
  return wrapper
}

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`missing element: ${selector}`)
  return el
}

describe('workspaceView terminal persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    Object.values(term).forEach((m) => m.mockClear())
    Object.values(socket).forEach((m) => m.mockClear())
    attachSessionSocket.mockClear()
    Object.values(statusStream).forEach((m) => m.mockClear())
    statusStreamOptions = null
    openSessionStatusStream.mockClear()
    getWorkspace.mockReset()
    attachRepository.mockReset()
    detachRepository.mockReset()
    startSession.mockReset()
    startSession.mockResolvedValue({ sessionId: 'sess-new' })
    stopSession.mockReset()
    stopSession.mockResolvedValue(undefined)
    listRepositories.mockReset()
    listRepositories.mockResolvedValue([])
    sendInput.mockReset()
    stageInput.mockReset()
    restartSession.mockReset()
    restartSession.mockResolvedValue({ sessionId: 'sess-a', epoch: 2, generation: 4, status: 'RUNNING' })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  it('keeps every live session terminal mounted, one socket per session', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b' })]))
    const wrapper = await mountView()

    expect(attachSessionSocket).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[data-testid="session-terminal"]').length).toBe(2)
  })

  it('switching the active session does not dispose the previous terminal or close its socket', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b' })]))
    const wrapper = await mountView()
    const store = useWorkspacesStore()

    store.activeSessionId = 'sess-a'
    await wrapper.vm.$nextTick()
    store.activeSessionId = 'sess-b'
    await wrapper.vm.$nextTick()

    expect(socket.close).not.toHaveBeenCalled()
    expect(term.dispose).not.toHaveBeenCalled()
    expect(attachSessionSocket).toHaveBeenCalledTimes(2)
  })

  it('drops a session that stopped, disposing its terminal and closing its socket', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b' })]))
    const wrapper = await mountView()
    const store = useWorkspacesStore()
    expect(attachSessionSocket).toHaveBeenCalledTimes(2)

    store.sessions = [fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b', status: 'STOPPED' })]
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="session-terminal"]').length).toBe(1)
    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(term.dispose).toHaveBeenCalledTimes(1)
  })

  it('stages large text for a running session without requiring a gateway binding', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a', gatewayAgentId: null })]))
    stageInput.mockResolvedValue({
      path: '/workspace/.agent-inputs/20260604-source.txt',
      bytes: 14,
      name: 'source.txt',
    })
    const wrapper = await mountView()

    await wrapper.find('[data-testid="stage-input-open"]').trigger('click')
    await flush()
    const name = requireElement<HTMLInputElement>('[data-testid="stage-input-name"]')
    const content = requireElement<HTMLTextAreaElement>('[data-testid="stage-input-content"]')
    const submit = requireElement<HTMLButtonElement>('[data-testid="stage-input-submit"]')
    name.value = 'source.txt'
    name.dispatchEvent(new Event('input'))
    content.value = 'large document'
    content.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    submit.click()
    await flush()

    expect(stageInput).toHaveBeenCalledWith('ws-1', 'sess-a', 'large document', 'source.txt')
    expect(sendInput).toHaveBeenCalledWith(
      'ws-1',
      'sess-a',
      'Please read /workspace/.agent-inputs/20260604-source.txt and use it as the source document for the next task.',
      true,
    )
    expect(sendInput.mock.calls[0]?.[2]).not.toContain('large document')
  })

  it('composes the console with session list, hero terminal, lifecycle controls, and status rail', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a', gatewayAgentId: 'abc12345' })]))

    const wrapper = await mountView()
    const header = wrapper.get('[data-testid="workspace-view-header"]')
    const sessionList = wrapper.get('[data-testid="workspace-session-list"]')
    const hero = wrapper.get('[data-testid="workspace-hero-terminal"]')
    const sidebar = wrapper.get('[data-testid="workspace-sidebar"]')

    expect(header.find('[data-testid="workspace-session-list-toggle"]').exists()).toBe(true)
    expect(header.find('[data-testid="stage-input-open"]').exists()).toBe(false)
    expect(sessionList.find('[data-testid="session-tabs"]').exists()).toBe(true)
    expect(sessionList.find('[data-testid="session-tab-sess-a"]').exists()).toBe(true)
    expect(hero.find('[data-testid="session-terminal"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="session-status-rail"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="workspace-lifecycle-controls"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="workspace-new-agent"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="workspace-tools-panel"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="stage-input-open"]').exists()).toBe(true)
    expect(sidebar.find('[data-testid="workspace-repositories-panel"]').exists()).toBe(true)
  })

  for (const status of ['STOPPED', 'FAILED'] as const) {
    it(`keeps retained ${status.toLowerCase()} sessions in the session rail without mounting a terminal`, async () => {
      getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b', status })]))

      const wrapper = await mountView()
      const sessionList = wrapper.get('[data-testid="workspace-session-list"]')

      expect(sessionList.find('[data-testid="session-tab-sess-a"]').exists()).toBe(true)
      expect(sessionList.find('[data-testid="session-tab-sess-b"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="session-terminal"]').length).toBe(1)
    })
  }

  it('shows an empty live-session surface and disables staged input when every session is closed', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a', status: 'STOPPED' })]))

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="session-tab-sess-a"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="session-terminal"]').length).toBe(0)
    expect(wrapper.get('[data-testid="workspace-empty-state"]').text()).toContain('Session stopped')
    expect(wrapper.get('[data-testid="workspace-empty-state"]').text()).toContain('Restart this session or switch to a live one.')
    expect(wrapper.get('[data-testid="stage-input-open"]').attributes('disabled')).toBeDefined()
  })

  it('collapses the session list with the rail control', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })]))

    const wrapper = await mountView()
    const toggle = wrapper.get('[data-testid="workspace-session-list-collapse"]')
    const sessionList = wrapper.get('[data-testid="workspace-session-list"]')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-controls')).toBe('workspace-session-list-tabs')
    expect(sessionList.classes()).toContain('lg:w-72')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(sessionList.classes()).toContain('lg:w-14')
    expect(sessionList.attributes('aria-hidden')).toBe('true')
  })

  it('opens the status subscription for the workspace and closes it on unmount', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })]))

    const wrapper = await mountView()

    expect(openSessionStatusStream).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="session-status-rail-connection"]').attributes('data-state')).toBe('connecting')

    statusStreamOptions?.onOpen?.()
    await flush()

    expect(wrapper.get('[data-testid="session-status-rail-connection"]').attributes('data-state')).toBe('open')

    wrapper.unmount()

    expect(statusStream.close).toHaveBeenCalledOnce()
  })

  it('drives restart confirmation, progress, replay, live, and failed states through the rail', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a', generation: 3 })]))
    const wrapper = await mountView()
    const store = useWorkspacesStore()

    await wrapper.get('[data-testid="workspace-active-restart"]').trigger('click')
    await flush()

    expect(wrapper.find('[data-testid="workspace-restart-confirmation"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="workspace-lifecycle-controls"]').element)

    await wrapper.get('[data-testid="workspace-restart-confirm"]').trigger('click')
    await flush()

    expect(restartSession).toHaveBeenCalledWith('ws-1', 'sess-a', 3)
    expect(wrapper.get('[data-testid="session-status-rail-restart"]').text()).toContain('Reattaching terminal')

    store.markRestartReplayingHistory('sess-a')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="session-status-rail-restart"]').text()).toContain('Replaying terminal history')

    store.markRestartLive('sess-a')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="session-status-rail-restart"]').text()).toContain('Restart complete')
    expect(wrapper.find('[data-testid="workspace-restart-dismiss"]').exists()).toBe(true)

    store.markRestartFailed('sess-a')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="session-status-rail-restart"]').text()).toContain('Restart failed')
  })

  it('focuses the hero terminal when switching sessions from the rail', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' }), fakeSession({ id: 'sess-b', status: 'STOPPED' })]))
    const wrapper = await mountView()

    await wrapper.get('[data-testid="session-tab-sess-b"]').trigger('click')
    await flush()

    expect(useWorkspacesStore().activeSessionId).toBe('sess-b')
    expect(document.activeElement).toBe(wrapper.get('[data-testid="workspace-hero-terminal"]').element)
  })

  it('keeps mobile-safe viewport and target sizing on the console shell', async () => {
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })]))

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="workspace-console"]').classes()).toContain('h-dvh')
    expect(wrapper.get('[data-testid="workspace-console"]').classes()).toContain('min-h-[100svh]')
    expect(wrapper.get('[data-testid="workspace-console"]').classes()).toContain('pt-[env(safe-area-inset-top)]')
    expect(wrapper.get('[data-testid="workspace-console-main"]').classes()).toContain(
      'pb-[env(safe-area-inset-bottom)]',
    )
    expect(wrapper.get('[data-testid="workspace-session-list-toggle"]').classes()).toContain('min-h-10')
    expect(wrapper.get('[data-testid="workspace-active-restart"]').classes()).toContain('min-h-10')
  })

  it('reconciles start and stop actions through the active workspace snapshot', async () => {
    getWorkspace
      .mockResolvedValueOnce(detail([]))
      .mockResolvedValueOnce(detail([fakeSession({ id: 'sess-new' })]))
      .mockResolvedValueOnce(detail([fakeSession({ id: 'sess-new', status: 'STOPPED' })]))
    const wrapper = await mountView()

    await wrapper.get('[data-testid="workspace-new-agent"]').trigger('click')
    await flush()

    expect(startSession).toHaveBeenCalledWith('ws-1', 'CLAUDE', expect.any(Function))
    expect(wrapper.get('[data-testid="workspace-active-session-label"]').text()).toBe('sess-new')

    await wrapper.get('[data-testid="workspace-active-stop"]').trigger('click')
    await flush()

    expect(stopSession).toHaveBeenCalledWith('ws-1', 'sess-new')
    expect(wrapper.get('[data-testid="workspace-empty-state"]').text()).toContain('Session stopped')
  })

  it('renders attached repositories, marks the primary, and shows split guidance', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    const destination = fakeWorkspaceRepository({
      id: 'repo-dest',
      name: 'split-dest',
      repoUrl: 'git@github.com:owner/split-dest.git',
    })
    getWorkspace.mockResolvedValue(
      detail([fakeSession({ id: 'sess-a' })], { projectId: 'project-1', repositories: [primary, destination] }),
    )

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="workspace-repositories-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="workspace-repository-primary-repo-primary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="workspace-detach-repository-repo-primary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="workspace-detach-repository-repo-dest"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="workspace-split-command"]').text()).toBe(
      'cd /workspace/primary && council split --path path/to/subtree --dest owner/split-dest',
    )
    expect(wrapper.find('[data-testid="split-follow-up"]').text()).toContain(
      'Keep owner/split-dest linked in the project repository pool',
    )
    expect(wrapper.find('[data-testid="split-follow-up"]').text()).toContain(
      'Start the next runner from owner/split-dest after the split lands.',
    )
  })

  it('shows non-project split follow-up wording', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    const destination = fakeWorkspaceRepository({
      id: 'repo-dest',
      name: 'split-dest',
      repoUrl: 'git@github.com:owner/split-dest.git',
    })
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })], { repositories: [primary, destination] }))

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="split-follow-up"]').text()).toContain(
      'Keep owner/split-dest attached here, or open a new workspace from that repository.',
    )
  })

  it('sends the split command to the active running session without requiring a gateway binding', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    const destination = fakeWorkspaceRepository({
      id: 'repo-dest',
      name: 'split-dest',
      repoUrl: 'git@github.com:owner/split-dest.git',
    })
    getWorkspace.mockResolvedValue(
      detail([fakeSession({ id: 'sess-a', gatewayAgentId: null })], { repositories: [primary, destination] }),
    )

    const wrapper = await mountView()
    await wrapper.find('[data-testid="split-send-command"]').trigger('click')
    await flush()

    expect(sendInput).toHaveBeenCalledWith(
      'ws-1',
      'sess-a',
      'cd /workspace/primary && council split --path path/to/subtree --dest owner/split-dest',
      true,
    )
  })

  it('loads candidate repositories, filters attached repositories, and attaches the selected one', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    const extra = fakeWorkspaceRepository({
      id: 'repo-extra',
      name: 'extra',
      repoUrl: 'git@github.com:owner/extra.git',
    })
    getWorkspace
      .mockResolvedValueOnce(detail([fakeSession({ id: 'sess-a' })], { repositories: [primary] }))
      .mockResolvedValueOnce(detail([fakeSession({ id: 'sess-a' })], { repositories: [primary, extra] }))
    listRepositories.mockResolvedValue([
      fakeRepository({ id: 'repo-primary', name: 'primary' }),
      fakeRepository({ id: 'repo-extra', name: 'extra', repoUrl: 'git@github.com:owner/extra.git' }),
    ])
    attachRepository.mockResolvedValue(undefined)
    const wrapper = await mountView()

    await wrapper.find('[data-testid="workspace-add-repository"]').trigger('click')
    await flush()

    expect(listRepositories).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-testid="repository-picker-radio-repo-primary"]')).toBeNull()
    const extraRadio = requireElement<HTMLInputElement>('[data-testid="repository-picker-radio-repo-extra"]')
    extraRadio.click()
    await wrapper.vm.$nextTick()
    requireElement<HTMLButtonElement>('[data-testid="repository-picker-submit"]').click()
    await flush()

    expect(attachRepository).toHaveBeenCalledWith('ws-1', 'repo-extra')
    expect(wrapper.find('[data-testid="workspace-repository-repo-extra"]').exists()).toBe(true)
  })

  it('opens the repository picker from split guidance when a destination repository is needed', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })], { repositories: [primary] }))
    listRepositories.mockResolvedValue([
      fakeRepository({ id: 'repo-primary', name: 'primary' }),
      fakeRepository({ id: 'repo-extra', name: 'extra', repoUrl: 'git@github.com:owner/extra.git' }),
    ])
    const wrapper = await mountView()

    await wrapper.find('[data-testid="split-attach-destination"]').trigger('click')
    await flush()

    expect(listRepositories).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-testid="repository-picker-radio-repo-extra"]')).not.toBeNull()
  })

  it('removes non-primary repositories and reports detach failures', async () => {
    const primary = fakeWorkspaceRepository({ id: 'repo-primary', name: 'primary', isPrimary: true })
    const destination = fakeWorkspaceRepository({
      id: 'repo-dest',
      name: 'split-dest',
      repoUrl: 'git@github.com:owner/split-dest.git',
    })
    getWorkspace.mockResolvedValue(detail([fakeSession({ id: 'sess-a' })], { repositories: [primary, destination] }))
    detachRepository.mockRejectedValue(new Error('detach failed'))
    const wrapper = await mountView()

    await wrapper.find('[data-testid="workspace-detach-repository-repo-dest"]').trigger('click')
    await flush()

    expect(detachRepository).toHaveBeenCalledWith('ws-1', 'repo-dest')
    expect(wrapper.find('[data-testid="workspace-repositories-panel"]').text()).toContain(
      'Could not remove the repository',
    )
  })
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
