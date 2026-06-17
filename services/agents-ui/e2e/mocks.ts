import type { Page, Route } from '@playwright/test'

const now = '2026-06-12T12:00:00.000Z'
const sseTs = '2026-06-12T12:00:01.000Z'
const stopTs = '2026-06-12T12:00:02.000Z'

interface MockOptions {
  authenticated?: boolean
  /** Runner connect response state. Default: 'READY'. Use 'BOOTING' to test disabled spawn. */
  runnerState?: 'READY' | 'BOOTING'
}

interface MockWorkspace {
  id: string
  name: string
  repoUrl: string | null
  branch: string | null
  podName: string | null
  gatewayEndpoint: string | null
  status: 'READY'
  kind: 'REPO_BACKED' | 'SCRATCH'
  projectId: string | null
  repositoryId: string | null
  githubLinkId: string | null
  createdAt: string
  updatedAt: string
}

interface MockAgentSession {
  id: string
  workspaceId: string
  kind: 'CLAUDE' | 'CODEX' | 'SHELL'
  gatewayAgentId: string | null
  epoch: number
  generation: number
  gatewayBoundAt: string | null
  status: 'STARTING' | 'RUNNING' | 'STOPPED' | 'FAILED'
  idle: boolean
  createdAt: string
  updatedAt: string
}

interface MockChatSession {
  id: string
  userId: string
  title: string | null
  status: 'ACTIVE'
  createdAt: string
  updatedAt: string
}

interface MockChatMessage {
  id: string
  sessionId: string
  role: 'USER' | 'ASSISTANT'
  body: string
  createdAt: string
}

const baseWorkspaces: MockWorkspace[] = [
  {
    id: 'ws-1',
    name: 'Demo workspace',
    repoUrl: 'git@github.com:ExtraToast/agents.git',
    branch: 'main',
    podName: 'agents-ui-e2e',
    gatewayEndpoint: 'http://agent-gateway',
    status: 'READY',
    kind: 'REPO_BACKED',
    projectId: 'project-1',
    repositoryId: 'repo-1',
    githubLinkId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'scratch-1',
    name: 'Scratch pad',
    repoUrl: null,
    branch: null,
    podName: 'scratch-e2e',
    gatewayEndpoint: 'http://agent-gateway',
    status: 'READY',
    kind: 'SCRATCH',
    projectId: null,
    repositoryId: null,
    githubLinkId: null,
    createdAt: now,
    updatedAt: now,
  },
]

const baseSessions: MockAgentSession[] = [
  {
    id: 'sess-1',
    workspaceId: 'ws-1',
    kind: 'CODEX',
    gatewayAgentId: 'gateway-agent-1',
    epoch: 1,
    generation: 1,
    gatewayBoundAt: now,
    status: 'RUNNING',
    idle: false,
    createdAt: now,
    updatedAt: now,
  },
]

const chatSession: MockChatSession = {
  id: 'chat-1',
  userId: 'user-1',
  title: 'Planning brief',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
}

const baseChatMessages: MockChatMessage[] = [
  {
    id: 'msg-1',
    sessionId: 'chat-1',
    role: 'USER',
    body: 'What is the plan?',
    createdAt: now,
  },
  {
    id: 'msg-2',
    sessionId: 'chat-1',
    role: 'ASSISTANT',
    body: 'Use the sessions workspace.',
    createdAt: now,
  },
]

export async function installAuthenticatedAppMocks(page: Page, options: MockOptions = {}): Promise<void> {
  await installBrowserConnectionMocks(page)
  await page.context().addCookies([
    {
      name: 'XSRF-TOKEN',
      value: 'e2e-csrf',
      url: 'http://localhost:5174',
    },
  ])
  await installApiMocks(page, options)
}

async function installBrowserConnectionMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // SSE control surface — tests call window.__mockSseControl.closeAll() /
    // reopenAll() to simulate native EventSource reconnect behaviour.
    const sseInstances: any[] = []

    Object.defineProperty(window, '__mockSseControl', {
      configurable: true,
      writable: true,
      value: {
        instances: sseInstances,
        closeAll() {
          sseInstances.forEach((inst) => inst._triggerClose())
        },
        reopenAll() {
          sseInstances.forEach((inst) => inst._doOpen())
        },
      },
    })

    class MockEventSource extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSED = 2

      readonly url: string
      readonly withCredentials: boolean
      readyState = MockEventSource.CONNECTING
      onopen: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      // Set by close() to prevent simulation-triggered reopens after deliberate close.
      _manualClosed = false

      constructor(url: string | URL, init?: EventSourceInit) {
        super()
        this.url = String(url)
        this.withCredentials = init?.withCredentials ?? false
        sseInstances.push(this)
        window.setTimeout(() => {
          this._doOpen()
        }, 0)
      }

      _doOpen(): void {
        if (this._manualClosed) return
        this.readyState = MockEventSource.OPEN
        const openEvent = new Event('open')
        this.onopen?.(openEvent)
        this.dispatchEvent(openEvent)
        this._emitInitialEvents()
      }

      _triggerClose(): void {
        if (this.readyState === MockEventSource.CLOSED) return
        this.readyState = MockEventSource.CLOSED
        const errorEvent = new Event('error')
        this.onerror?.(errorEvent)
        this.dispatchEvent(errorEvent)
      }

      _emitInitialEvents(): void {
        if (this.url.includes('/sessions/events')) {
          this.dispatchEvent(
            new MessageEvent('status', {
              data: JSON.stringify({
                sessionId: 'sess-1',
                status: 'RUNNING',
                idle: false,
                ts: '2026-06-12T12:00:01.000Z',
              }),
            }),
          )
        }
      }

      close(): void {
        this._manualClosed = true
        this.readyState = MockEventSource.CLOSED
      }
    }

    class MockWebSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3

      readonly url: string
      readonly protocol = ''
      readonly extensions = ''
      binaryType: BinaryType = 'blob'
      bufferedAmount = 0
      readyState = MockWebSocket.CONNECTING
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent<string>) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      onclose: ((event: CloseEvent) => void) | null = null

      constructor(url: string | URL) {
        super()
        this.url = String(url)
        window.setTimeout(() => {
          if (this.readyState !== MockWebSocket.CONNECTING) return
          this.readyState = MockWebSocket.OPEN
          const openEvent = new Event('open')
          this.onopen?.(openEvent)
          this.dispatchEvent(openEvent)
          this.emitMessage({ control: 'SNAPSHOT', epoch: 1 })
          this.emitMessage({ output: 'Agent console ready\\r\\n', epoch: 1, off: 21 })
          this.emitMessage({ control: 'REPLAY_COMPLETE', epoch: 1, cursor: { epoch: 1, off: 21 } })
        }, 0)
      }

      send(): void {}

      close(code = 1000, reason = ''): void {
        if (this.readyState === MockWebSocket.CLOSED) return
        this.readyState = MockWebSocket.CLOSED
        const closeEvent = new CloseEvent('close', { code, reason })
        this.onclose?.(closeEvent)
        this.dispatchEvent(closeEvent)
      }

      private emitMessage(payload: Record<string, unknown>): void {
        const messageEvent = new MessageEvent<string>('message', { data: JSON.stringify(payload) })
        this.onmessage?.(messageEvent)
        this.dispatchEvent(messageEvent)
      }
    }

    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    })
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    })
  })
}

async function installApiMocks(page: Page, options: MockOptions): Promise<void> {
  const authenticated = options.authenticated ?? true
  const mockWorkspaces = baseWorkspaces.map((candidate) => ({ ...candidate }))
  const mockSessions = baseSessions.map((candidate) => ({ ...candidate }))
  let nextSessionNumber = 2
  let nextMessageNumber = 3
  let chatMessages = baseChatMessages.map((candidate) => ({ ...candidate }))
  // First connect returns the configured state; subsequent calls return BOOTING so
  // tests can detect unwanted reconnects by observing the spawn-button label.
  let connectCallCount = 0

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = request.method()

    if (path === '/auth/me') {
      if (!authenticated) {
        await json(route, { error: 'unauthorized' }, 401)
        return
      }
      await json(route, {
        id: 'user-1',
        username: 'e2e-user',
        email: 'e2e@example.com',
        role: 'ADMIN',
      })
      return
    }

    if (path === '/workspaces' && method === 'GET') {
      await json(route, mockWorkspaces)
      return
    }

    if (path === '/workspaces' && method === 'POST') {
      const body = postJson(route)
      const kind = workspaceKind(body.kind) ?? 'SCRATCH'
      const created = workspace({
        id: `scratch-${mockWorkspaces.length + 1}`,
        name: typeof body.name === 'string' && body.name ? body.name : 'Scratch workspace',
        kind,
      })
      mockWorkspaces.unshift(created)
      await json(route, created, 201)
      return
    }

    const connectMatch = path.match(/^\/workspaces\/([^/]+)\/connect$/)
    if (connectMatch && method === 'POST') {
      connectCallCount++
      // Only the first connect uses the configured state. Subsequent calls return
      // BOOTING so tests verifying "no reconnect on refresh" can detect regressions
      // by observing the spawn-button label change to "Runner booting…".
      const state = connectCallCount > 1 ? 'BOOTING' : (options.runnerState ?? 'READY')
      await json(route, {
        workspaceId: connectMatch[1]!,
        setupId: 'setup-1',
        setupVersion: 1,
        state,
        checkedAt: now,
      })
      return
    }

    const workspaceDetailMatch = path.match(/^\/workspaces\/([^/]+)$/)
    if (workspaceDetailMatch && method === 'GET') {
      const id = workspaceDetailMatch[1]!
      const found = mockWorkspaces.find((candidate) => candidate.id === id)
      await json(route, {
        workspace: {
          ...(found ?? workspace({ id })),
          repositories: [
            {
              id: 'repo-1',
              name: 'agents',
              repoUrl: 'git@github.com:ExtraToast/agents.git',
              defaultBranch: 'main',
              vaultKeyPath: 'kv/agents',
              createdAt: now,
              updatedAt: now,
              verification: null,
              isPrimary: true,
              attachedAt: now,
            },
          ],
        },
        sessions: mockSessions.filter((session) => session.workspaceId === id),
      })
      return
    }

    const turnsMatch = path.match(/^\/workspaces\/([^/]+)\/sessions\/([^/]+)\/turns$/)
    if (turnsMatch && method === 'GET') {
      await json(route, [
        {
          id: 'turn-1',
          sessionId: turnsMatch[2],
          role: 'AGENT',
          body: 'Workspace loaded.',
          createdAt: now,
        },
      ])
      return
    }

    const startSessionMatch = path.match(/^\/workspaces\/([^/]+)\/sessions$/)
    if (startSessionMatch && method === 'POST') {
      const workspaceId = startSessionMatch[1]!
      const body = postJson(route)
      const kind = agentKind(body.kind) ?? 'CLAUDE'
      const session = agentSession({
        id: `sess-${nextSessionNumber++}`,
        workspaceId,
        kind,
      })
      mockSessions.unshift(session)
      await json(route, { sessionId: session.id }, 201)
      return
    }

    const restartSessionMatch = path.match(/^\/workspaces\/([^/]+)\/sessions\/([^/]+)\/restart$/)
    if (restartSessionMatch && method === 'POST') {
      const sessionId = restartSessionMatch[2]!
      const session = mockSessions.find((s) => s.id === sessionId)
      if (session) {
        session.epoch = (session.epoch ?? 1) + 1
        session.generation = (session.generation ?? 1) + 1
        session.status = 'STARTING'
        session.updatedAt = sseTs
      }
      await json(route, {
        sessionId,
        epoch: session?.epoch ?? 2,
        generation: session?.generation ?? 2,
        status: 'STARTING',
      })
      return
    }

    const stagedInputMatch = path.match(/^\/workspaces\/([^/]+)\/sessions\/([^/]+)\/staged-inputs$/)
    if (stagedInputMatch && method === 'POST') {
      await json(route, { path: '/workspace/source.txt', bytes: 24, name: 'source.txt' }, 201)
      return
    }

    const sessionInputMatch = path.match(/^\/workspaces\/([^/]+)\/sessions\/([^/]+)\/input$/)
    if (sessionInputMatch && method === 'POST') {
      await empty(route)
      return
    }

    const stopSessionMatch = path.match(/^\/workspaces\/([^/]+)\/sessions\/([^/]+)$/)
    if (stopSessionMatch && method === 'DELETE') {
      const session = mockSessions.find((candidate) => candidate.id === stopSessionMatch[2])
      if (session) {
        session.status = 'STOPPED'
        // Use a timestamp newer than the SSE event (sseTs = 01s) so that
        // syncRestSessions drops the RUNNING overlay and shows STOPPED.
        session.updatedAt = stopTs
      }
      await empty(route)
      return
    }

    if (path === '/chat-sessions' && method === 'GET') {
      await json(route, [chatSession])
      return
    }

    if (path === '/chat-sessions' && method === 'POST') {
      await json(route, chatSession, 201)
      return
    }

    if (path === '/chat-sessions/chat-1' && method === 'GET') {
      await json(route, { session: chatSession, messages: chatMessages })
      return
    }

    if (path === '/chat-sessions/chat-1/messages' && method === 'POST') {
      const body = postJson(route)
      const role = chatRole(body.role) ?? 'USER'
      const message: MockChatMessage = {
        id: `msg-${nextMessageNumber++}`,
        sessionId: 'chat-1',
        role,
        body: typeof body.body === 'string' ? body.body : '',
        createdAt: now,
      }
      chatMessages = [...chatMessages, message]
      await json(route, message, 201)
      return
    }

    if (path === '/chat-sessions/chat-1/messages/stream' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: chunk',
          'data: {"text":"Mock streamed answer"}',
          '',
          'event: done',
          'data: {"messageId":"msg-streamed"}',
          '',
          '',
        ].join('\n'),
      })
      return
    }

    await json(route, { error: `Unhandled mock route: ${method} ${path}` }, 404)
  })
}

function workspace(overrides: Partial<MockWorkspace>): MockWorkspace {
  return {
    ...baseWorkspaces[0]!,
    ...overrides,
  }
}

function agentSession(overrides: Partial<MockAgentSession>): MockAgentSession {
  return {
    ...baseSessions[0]!,
    ...overrides,
    gatewayAgentId: `gateway-${overrides.id ?? 'sess'}`,
    createdAt: now,
    updatedAt: now,
  }
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function empty(route: Route): Promise<void> {
  await route.fulfill({ status: 204, body: '' })
}

function postJson(route: Route): Record<string, unknown> {
  const data = route.request().postData()
  if (!data) return {}
  try {
    const parsed: unknown = JSON.parse(data)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function workspaceKind(value: unknown): MockWorkspace['kind'] | null {
  return value === 'REPO_BACKED' || value === 'SCRATCH' ? value : null
}

function agentKind(value: unknown): MockAgentSession['kind'] | null {
  return value === 'CLAUDE' || value === 'CODEX' || value === 'SHELL' ? value : null
}

function chatRole(value: unknown): MockChatMessage['role'] | null {
  return value === 'USER' || value === 'ASSISTANT' ? value : null
}
