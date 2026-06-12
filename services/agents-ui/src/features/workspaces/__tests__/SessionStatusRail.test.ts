import type { SessionConsoleViewModel } from '../stores/sessionConsoleViewModels'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionStatusRail from '../components/SessionStatusRail.vue'

interface RailSession extends SessionConsoleViewModel {
  lastStatusUpdate?: string | null
  updatedAt?: string | null
  epoch?: number | null
  generation?: number | null
}

function fakeSession(over: Partial<RailSession> = {}): RailSession {
  return {
    id: 'sess-123456',
    shortId: 'sess-123',
    label: 'backend',
    kind: 'CODEX',
    kindLabel: 'Codex',
    status: 'RUNNING',
    idle: false,
    isActive: true,
    isLive: true,
    canAttachTerminal: true,
    canStop: true,
    lastStatusUpdate: '2026-06-12T10:05:00Z',
    epoch: 2,
    generation: 4,
    affordance: {
      text: 'Running',
      ariaLabel: 'Session is running',
      description: 'Terminal is available',
      icon: 'play',
      shape: 'dot',
      tone: 'success',
    },
    ...over,
  }
}

describe('sessionStatusRail', () => {
  it('presents status, kind, update time, epoch generation, and connection state', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), connectionState: 'open' },
    })

    expect(wrapper.get('[data-testid="session-status-rail"]').attributes('aria-label')).toContain(
      'backend: Session is running',
    )
    expect(wrapper.get('[data-testid="session-status-rail-label"]').text()).toBe('backend')
    expect(wrapper.get('[data-testid="session-status-rail-kind"]').text()).toBe('Codex')
    expect(wrapper.get('[data-testid="session-status-chip-text"]').text()).toBe('Running')
    expect(wrapper.get('[data-testid="session-status-rail-updated"]').text()).toBe('2026-06-12 10:05 UTC')
    expect(wrapper.get('[data-testid="session-status-rail-epoch"]').text()).toBe('Epoch 2 / Gen 4')
    expect(wrapper.get('[data-testid="session-status-rail-connection"]').attributes('data-state')).toBe('open')
    expect(wrapper.get('[data-testid="session-status-rail-connection"]').text()).toContain('Connected')
  })

  it('shows idle connection and missing metadata distinctly', () => {
    const wrapper = mount(SessionStatusRail, {
      props: {
        session: fakeSession({ lastStatusUpdate: null, epoch: null, generation: null }),
        connectionState: 'idle',
      },
    })

    expect(wrapper.get('[data-testid="session-status-rail-connection"]').attributes('data-state')).toBe('idle')
    expect(wrapper.get('[data-testid="session-status-rail-connection"]').text()).toContain('Stream idle')
    expect(wrapper.get('[data-testid="session-status-rail-updated"]').text()).toBe('No status update')
    expect(wrapper.get('[data-testid="session-status-rail-epoch"]').text()).toBe('Epoch - / Gen -')
  })

  it('renders restart progress through the named slot', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), connectionState: 'connecting' },
      slots: {
        'restart-progress': '<span data-testid="custom-restart">Restarting generation 5</span>',
      },
    })

    expect(wrapper.find('[data-testid="session-status-rail-restart"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="custom-restart"]').text()).toBe('Restarting generation 5')
  })

  it('keeps stable rail dimensions and renders the restart label fallback', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), restartLabel: 'Restart queued' },
    })

    const rail = wrapper.get('[data-testid="session-status-rail"]')
    expect(rail.classes()).toContain('min-h-[6.5rem]')
    expect(rail.classes()).toContain('min-w-[18rem]')
    expect(wrapper.get('[data-testid="session-status-rail-restart"]').text()).toBe('Restart queued')
  })
})
