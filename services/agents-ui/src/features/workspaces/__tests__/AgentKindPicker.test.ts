import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentKindPicker from '../components/AgentKindPicker.vue'

describe('AgentKindPicker', () => {
  it('renders local agent icons while keeping accessible button labels', () => {
    const wrapper = mount(AgentKindPicker, {
      props: { modelValue: 'CLAUDE' },
    })

    const claude = wrapper.get('button[aria-label="Claude Code"]')
    const codex = wrapper.get('button[aria-label="Codex"]')
    const shell = wrapper.get('button[aria-label="Shell"]')

    expect(claude.attributes('aria-pressed')).toBe('true')
    expect(claude.get('img').attributes('src')).toContain('claude-code.svg')
    expect(claude.get('img').attributes('aria-hidden')).toBe('true')
    expect(codex.get('img').attributes('src')).toContain('codex.svg')
    expect(shell.find('img').exists()).toBe(false)
    expect(shell.text()).toContain('$')
  })
})
