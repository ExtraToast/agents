import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentKindPicker from '../components/AgentKindPicker.vue'

function expectSvgIcon(src: string | undefined, title: string): void {
  expect(src).toMatch(/^data:image\/svg\+xml/)
  expect(decodeURIComponent(src ?? '')).toContain(`<title>${title}</title>`)
}

describe('agentKindPicker', () => {
  it('renders local agent icons while keeping accessible button labels', () => {
    const wrapper = mount(AgentKindPicker, {
      props: { modelValue: 'CLAUDE' },
    })

    const claude = wrapper.get('button[aria-label="Claude Code"]')
    const codex = wrapper.get('button[aria-label="Codex"]')
    const shell = wrapper.get('button[aria-label="Shell"]')

    expect(claude.attributes('aria-pressed')).toBe('true')
    expectSvgIcon(claude.get('img').attributes('src'), 'Claude Code')
    expect(claude.get('img').attributes('aria-hidden')).toBe('true')
    expectSvgIcon(codex.get('img').attributes('src'), 'Codex')
    expect(shell.find('img').exists()).toBe(false)
    expect(shell.text()).toContain('$')
  })
})
