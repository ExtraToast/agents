import type { SessionConsoleViewModel } from '../stores/sessionConsoleViewModels'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionStatusChip from '../components/SessionStatusChip.vue'

function fakeSession(over: Partial<SessionConsoleViewModel> = {}): SessionConsoleViewModel {
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

describe('sessionStatusChip', () => {
  it('renders the derived status text, icon, shape, and accessible label', () => {
    const wrapper = mount(SessionStatusChip, {
      props: { session: fakeSession() },
    })

    expect(wrapper.get('[data-testid="session-status-chip"]').attributes('role')).toBe('status')
    expect(wrapper.get('[data-testid="session-status-chip"]').attributes('aria-label')).toBe(
      'backend: Session is running',
    )
    expect(wrapper.get('[data-testid="session-status-chip"]').attributes('data-tone')).toBe('success')
    expect(wrapper.get('[data-testid="session-status-chip"]').attributes('data-shape')).toBe('dot')
    expect(wrapper.get('[data-testid="session-status-chip"]').attributes('data-icon')).toBe('play')
    expect(wrapper.get('[data-testid="session-status-chip-text"]').text()).toBe('Running')
    expect(wrapper.get('[data-testid="session-status-chip-icon"]').text()).toBe('>')
  })

  it('shows idle as its own non-color state with stable compact dimensions', () => {
    const wrapper = mount(SessionStatusChip, {
      props: {
        compact: true,
        session: fakeSession({
          idle: true,
          affordance: {
            text: 'Idle',
            ariaLabel: 'Session is running but idle',
            description: 'Runner is waiting for an agent binding',
            icon: 'pause',
            shape: 'ring',
            tone: 'warning',
          },
        }),
      },
    })

    const chip = wrapper.get('[data-testid="session-status-chip"]')
    expect(chip.attributes('data-idle')).toBe('true')
    expect(chip.attributes('data-shape')).toBe('ring')
    expect(chip.attributes('data-icon')).toBe('pause')
    expect(chip.attributes('aria-label')).toBe('backend: Session is running but idle: idle')
    expect(chip.classes()).toContain('h-7')
    expect(chip.classes()).toContain('min-w-[6rem]')
    expect(wrapper.get('[data-testid="session-status-chip-text"]').text()).toBe('Idle')
  })

  it('can include the agent kind without replacing the status text', () => {
    const wrapper = mount(SessionStatusChip, {
      props: { session: fakeSession({ kind: 'CLAUDE', kindLabel: 'Claude Code' }), showKind: true },
    })

    expect(wrapper.text()).toContain('CLAUDE')
    expect(wrapper.text()).toContain('Running')
  })
})
