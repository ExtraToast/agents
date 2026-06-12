import type { AgentSetupReference, AgentSetupValidationProblem, SetupPreview } from '../types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionSetupDiff from '../components/SessionSetupDiff.vue'

function setupRef(id: string, version: number): AgentSetupReference {
  return { id, version }
}

function preview(over: Partial<SetupPreview> = {}): SetupPreview {
  const current = setupRef('setup-current', 1)
  const target = setupRef('setup-next', 2)
  return {
    current,
    target,
    diff: {
      from: current,
      to: target,
      hasChanges: true,
      changes: [
        { field: 'image', fromValue: 'runner:current', toValue: 'runner:next', redacted: false },
        {
          field: 'knowledgeBearerSecret',
          fromValue: 'knowledge-secret-old',
          toValue: 'knowledge-secret-new',
          redacted: true,
        },
      ],
    },
    validation: {
      target,
      valid: true,
      issues: [],
      warnings: [{ code: 'deprecated', message: 'Tool profile is deprecated' }],
    },
    ...over,
  }
}

function problem(): AgentSetupValidationProblem {
  return {
    type: 'https://jorisjonkers.dev/errors/agent-setup-validation',
    title: 'Setup validation failed',
    status: 422,
    detail: 'Target setup is not valid for this session.',
    errors: [{ field: 'targetSetupId', message: 'Target setup is not selectable', rejectedValue: null }],
  }
}

describe('sessionSetupDiff', () => {
  it('renders from/to labels, changed values, redacted fields, and warnings', () => {
    const wrapper = mount(SessionSetupDiff, {
      props: { preview: preview() },
    })

    expect(wrapper.get('[data-testid="setup-diff-from"]').text()).toBe('setup-current@v1')
    expect(wrapper.get('[data-testid="setup-diff-to"]').text()).toBe('setup-next@v2')
    expect(wrapper.text()).toContain('runner:current')
    expect(wrapper.text()).toContain('runner:next')
    expect(wrapper.text()).toContain('Redacted')
    expect(wrapper.text()).not.toContain('knowledge-secret-old')
    expect(wrapper.text()).not.toContain('knowledge-secret-new')
    expect(wrapper.get('[data-testid="setup-diff-warnings"]').text()).toContain('Tool profile is deprecated')
  })

  it('renders validation problems without requiring a successful preview', () => {
    const wrapper = mount(SessionSetupDiff, {
      props: {
        preview: null,
        problem: problem(),
        from: setupRef('setup-current', 1),
        to: setupRef('setup-bad', 9),
      },
    })

    expect(wrapper.get('[data-testid="setup-diff-from"]').text()).toBe('setup-current@v1')
    expect(wrapper.get('[data-testid="setup-diff-to"]').text()).toBe('setup-bad@v9')
    expect(wrapper.get('[data-testid="setup-diff-issues"]').text()).toContain('Target setup is not selectable')
  })

  it('renders an explicit no-change state', () => {
    const current = setupRef('setup-current', 1)
    const wrapper = mount(SessionSetupDiff, {
      props: {
        preview: preview({
          target: current,
          diff: { from: current, to: current, hasChanges: false, changes: [] },
          validation: { target: current, valid: true, issues: [], warnings: [] },
        }),
      },
    })

    expect(wrapper.get('[data-testid="setup-diff-empty"]').text()).toBe('No setup field changes.')
  })
})
