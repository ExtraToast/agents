import type { ChatMessage, ChatSession } from '../types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatTab from '../components/ChatTab.vue'
import { listChatSessions } from '../services/chatSessionsService'
import { useChatSessionsStore } from '../stores/chatSessions'

vi.mock('@/lib/vueWebCommons', () => ({
  Card: {
    template:
      '<section v-bind="$attrs"><header><slot name="header" /></header><slot /><footer><slot name="footer" /></footer></section>',
  },
  SubmitButton: {
    props: ['disabled', 'label', 'status', 'type'],
    emits: ['click'],
    template:
      '<button v-bind="$attrs" :type="type || \'button\'" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
  useMutationState: () => ({
    status: { value: 'idle' },
    run: async (fn: () => Promise<void>) => fn(),
  }),
  useToast: () => ({
    success: vi.fn(),
    errorFromCatch: vi.fn(),
  }),
}))

vi.mock('../services/chatSessionsService', () => ({
  listChatSessions: vi.fn(),
  getChatSession: vi.fn(),
  startChatSession: vi.fn(),
  appendChatMessage: vi.fn(),
  archiveChatSession: vi.fn(),
  streamChatAnswer: vi.fn(),
}))

const mockedListChatSessions = vi.mocked(listChatSessions)

function fakeSession(over: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    title: 'Copy checks',
    status: 'ACTIVE',
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
    ...over,
  }
}

function fakeMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    sessionId: 'session-1',
    role: 'ASSISTANT',
    body: 'answer',
    createdAt: '2026-06-12T10:00:01Z',
    ...over,
  }
}

async function mountChat(messages: ChatMessage[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = fakeSession()
  mockedListChatSessions.mockResolvedValue([session])

  const store = useChatSessionsStore()
  store.sessions = [session]
  store.activeSessionId = session.id
  store.detailById = { [session.id]: { session, messages } }

  const wrapper = mount(ChatTab, {
    global: {
      plugins: [pinia],
    },
  })
  await flushPromises()
  return wrapper
}

describe('chatTab copy controls', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  it('keeps stable message text selectable and renders copy controls', async () => {
    const wrapper = await mountChat([
      fakeMessage({ id: 'user-message', role: 'USER', body: 'question' }),
      fakeMessage({ id: 'assistant-message', body: 'answer' }),
    ])

    expect(wrapper.get('[data-testid="chat-message-text-user-message"]').classes()).toContain('select-text')
    expect(wrapper.get('[data-testid="chat-message-text-assistant-message"]').classes()).toContain('select-text')
    expect(wrapper.get('[data-testid="chat-copy-user-message"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').attributes('disabled')).toBeUndefined()
  })

  it('copies message text and disables the control while copy is pending', async () => {
    let resolveCopy!: () => void
    writeText.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveCopy = resolve
    }))
    const wrapper = await mountChat([fakeMessage({ id: 'assistant-message', body: 'first line\nsecond line' })])

    await wrapper.get('[data-testid="chat-copy-assistant-message"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('first line\nsecond line')
    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').text()).toBe('Copying...')

    resolveCopy()
    await flushPromises()

    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').text()).toBe('Copied')
  })

  it('renders copy controls for streaming messages and disables empty streaming text', async () => {
    const wrapper = await mountChat([
      fakeMessage({ id: 'streaming-with-text', body: 'partial answer', streaming: true }),
      fakeMessage({ id: 'streaming-empty', body: '', streaming: true }),
    ])

    await wrapper.get('[data-testid="chat-copy-streaming-with-text"]').trigger('click')

    expect(wrapper.findAll('[data-testid="chat-message-streaming"]')).toHaveLength(2)
    expect(writeText).toHaveBeenCalledWith('partial answer')
    expect(wrapper.get('[data-testid="chat-copy-streaming-empty"]').attributes('disabled')).toBeDefined()
  })

  it('shows failed copy state and leaves the control enabled for retry', async () => {
    writeText.mockRejectedValueOnce(new Error('clipboard denied'))
    const wrapper = await mountChat([fakeMessage({ id: 'assistant-message', body: 'answer' })])

    await wrapper.get('[data-testid="chat-copy-assistant-message"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="chat-copy-assistant-message"]').text()).toBe('Copy failed')
    expect(wrapper.text()).toContain('Could not copy message.')
  })
})
