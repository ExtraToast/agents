import type { AgentSetupReference, SetupTargetOption, SetupTargetOptions } from '../types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SessionSetupPicker from '../components/SessionSetupPicker.vue'

function setupRef(id: string, version: number): AgentSetupReference {
  return { id, version }
}

function option(
  setup: AgentSetupReference,
  over: Partial<SetupTargetOption['setup']> = {},
  validation: Partial<SetupTargetOption['validation']> = {},
): SetupTargetOption {
  return {
    setup: {
      setup,
      displayName: `${setup.id} display`,
      description: `${setup.id} description`,
      image: `runner:${setup.id}`,
      cliTools: {},
      toolProfiles: [],
      toolAllowlist: [],
      selectable: true,
      defaultSelectable: false,
      unavailableReason: null,
      updatedAt: '2026-06-12T10:00:00Z',
      ...over,
    },
    validation: {
      target: setup,
      valid: true,
      issues: [],
      warnings: [],
      ...validation,
    },
  }
}

function options(over: Partial<SetupTargetOptions> = {}): SetupTargetOptions {
  const current = setupRef('setup-current', 1)
  const pending = setupRef('setup-next', 2)
  return {
    current,
    pending,
    options: [
      option(current, { displayName: 'Current setup', defaultSelectable: true }),
      option(pending, { displayName: 'Next setup' }),
    ],
    ...over,
  }
}

describe('sessionSetupPicker', () => {
  it('renders current, pending, and available setup targets', () => {
    const wrapper = mount(SessionSetupPicker, {
      props: {
        options: options(),
        selected: setupRef('setup-next', 2),
      },
    })

    expect(wrapper.get('[data-testid="setup-picker-current"]').text()).toContain('setup-current@v1')
    expect(wrapper.get('[data-testid="setup-picker-pending"]').text()).toContain('setup-next@v2')
    expect(wrapper.get('[data-testid="setup-picker-option-setup-current-1"]').text()).toContain('Current setup')
    expect(wrapper.get('[data-testid="setup-picker-option-setup-next-2"]').text()).toContain('Next setup')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Select Next setup"]').element.checked).toBe(true)
  })

  it('emits selectable valid targets and blocks invalid or unavailable targets', async () => {
    const current = setupRef('setup-current', 1)
    const invalid = setupRef('setup-invalid', 3)
    const unavailable = setupRef('setup-unavailable', 4)
    const wrapper = mount(SessionSetupPicker, {
      props: {
        options: options({
          options: [
            option(current, { displayName: 'Current setup' }),
            option(
              invalid,
              { displayName: 'Invalid setup' },
              { valid: false, issues: [{ code: 'invalid', message: 'Missing binding' }] },
            ),
            option(unavailable, { displayName: 'Unavailable setup', selectable: false, unavailableReason: 'Disabled' }),
          ],
        }),
        // Start with nothing selected so picking the current target is a real
        // radio transition that fires `change` (selecting an already-checked
        // radio dispatches no event).
        selected: null,
      },
    })

    await wrapper.get('input[aria-label="Select Current setup"]').setValue(true)
    await wrapper.get('input[aria-label="Select Invalid setup"]').trigger('change')
    await wrapper.get('input[aria-label="Select Unavailable setup"]').trigger('change')

    expect(wrapper.emitted('select')).toEqual([[current]])
    expect(wrapper.text()).toContain('Missing binding')
    expect(wrapper.text()).toContain('Disabled')
  })

  it('shows loading, error, and empty states', () => {
    const wrapper = mount(SessionSetupPicker, {
      props: {
        options: options({ options: [], pending: null }),
        selected: null,
        loading: true,
        error: 'Setup metadata is temporarily unavailable.',
      },
    })

    expect(wrapper.get('[data-testid="setup-picker-loading"]').text()).toBe('Loading')
    expect(wrapper.get('[data-testid="setup-picker-error"]').text()).toBe('Setup metadata is temporarily unavailable.')
    expect(wrapper.get('[data-testid="setup-picker-empty"]').text()).toBe('No setup targets available.')
  })
})
