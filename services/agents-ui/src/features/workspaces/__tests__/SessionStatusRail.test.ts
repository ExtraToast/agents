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
    currentSetup: { id: 'setup-current', version: 1 },
    pendingSetup: null,
    setupLabel: 'setup-current@v1',
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
  it('presents status, kind, update time, epoch generation, and header status chips', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), connectionState: 'open' },
    })

    expect(wrapper.get('[data-testid="session-status-rail"]').attributes('aria-label')).toContain(
      'backend: Session is running',
    )
    expect(wrapper.get('[data-testid="session-status-rail-label"]').text()).toBe('backend')
    expect(wrapper.get('[data-testid="session-status-rail-kind"]').text()).toBe('Codex')
    expect(wrapper.get('[data-testid="session-status-rail-running-chip"]').text()).toBe('Running')
    expect(wrapper.get('[data-testid="session-status-rail-connected-chip"]').text()).toBe('Connected')
    expect(wrapper.get('[data-testid="session-status-rail-connected-chip"]').attributes('data-state')).toBe('open')
    expect(wrapper.get('[data-testid="session-status-rail-updated"]').text()).toBe('2026-06-12 10:05 UTC')
    expect(wrapper.get('[data-testid="session-status-rail-epoch"]').text()).toBe('Epoch 2 / Gen 4')
    expect(wrapper.find('[data-testid="session-status-rail-connection"]').exists()).toBe(false)
  })

  it('hides the connected chip for idle connection and shows missing metadata distinctly', () => {
    const wrapper = mount(SessionStatusRail, {
      props: {
        session: fakeSession({ lastStatusUpdate: null, epoch: null, generation: null }),
        connectionState: 'idle',
      },
    })

    expect(wrapper.find('[data-testid="session-status-rail-connected-chip"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="session-status-rail-running-chip"]').text()).toBe('Running')
    expect(wrapper.get('[data-testid="session-status-rail-updated"]').text()).toBe('No status update')
    expect(wrapper.get('[data-testid="session-status-rail-epoch"]').text()).toBe('Epoch - / Gen -')
  })

  it('hides the running chip when the active session is not running', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession({ status: 'STOPPED' }), connectionState: 'open' },
    })

    expect(wrapper.find('[data-testid="session-status-rail-running-chip"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="session-status-rail-connected-chip"]').text()).toBe('Connected')
  })

  it('keeps stable rail dimensions without restart progress chrome', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession() },
    })

    const rail = wrapper.get('[data-testid="session-status-rail"]')
    expect(rail.classes()).toContain('min-h-[6.5rem]')
    expect(rail.classes()).toContain('min-w-[18rem]')
    expect(wrapper.find('[data-testid="session-status-rail-restart"]').exists()).toBe(false)
  })

  it('shows the runner image as up to date with no update button', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), runnerImage: { version: '0.12.0', upgradeAvailable: false } },
    })
    expect(wrapper.get('[data-testid="session-status-rail-runner-image"]').text()).toBe('0.12.0 · up to date')
    expect(wrapper.find('[data-testid="session-status-rail-update-runner"]').exists()).toBe(false)
  })

  it('shows an update-available runner image with an Update runner button that emits updateRunner', async () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), runnerImage: { version: '0.12.0', upgradeAvailable: true } },
    })
    expect(wrapper.get('[data-testid="session-status-rail-runner-image"]').text()).toBe('0.12.0 · update available')
    const button = wrapper.get('[data-testid="session-status-rail-update-runner"]')
    await button.trigger('click')
    expect(wrapper.emitted('updateRunner')).toHaveLength(1)
  })

  it('shows "No runner" and no update button when there is no runner image', () => {
    const wrapper = mount(SessionStatusRail, {
      props: { session: fakeSession(), runnerImage: null },
    })
    expect(wrapper.get('[data-testid="session-status-rail-runner-image"]').text()).toBe('No runner')
    expect(wrapper.find('[data-testid="session-status-rail-update-runner"]').exists()).toBe(false)
  })
})
