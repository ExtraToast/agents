import type { ProfileResponse } from '../types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changePassword,
  enrollTotp,
  getProfile,
  updateProfile,
  verifyTotp,
} from '../services/accountService'
import AccountView from '../views/AccountView.vue'

vi.mock('@/lib/vueWebCommons', () => ({
  Card: {
    template: '<div><slot /></div>',
  },
  FormErrors: {
    props: ['error'],
    template: '<div v-if="error" data-testid="form-error">{{ error }}</div>',
  },
  FormField: {
    props: ['error', 'label'],
    template:
      '<label><span>{{ label }}</span><slot :id="label" :invalid="Boolean(error)" /><small v-if="error">{{ error }}</small></label>',
  },
  SubmitButton: {
    props: ['disabled', 'label', 'status', 'type'],
    emits: ['click'],
    template:
      '<button v-bind="$attrs" :type="type || \'submit\'" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
  useFormErrors: () => ({
    general: { value: null },
    captureFromCatch: vi.fn(),
    clear: vi.fn(),
    fieldErrorFor: vi.fn(() => null),
  }),
  useMutationState: () => ({
    status: { value: 'idle' },
    run: async (fn: () => Promise<void>) => fn(),
  }),
  useToast: () => ({
    errorFromCatch: vi.fn(),
    success: vi.fn(),
  }),
}))

vi.mock('../services/accountService', () => ({
  changePassword: vi.fn(),
  enrollTotp: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  verifyTotp: vi.fn(),
}))

const mocked = {
  changePassword: vi.mocked(changePassword),
  enrollTotp: vi.mocked(enrollTotp),
  getProfile: vi.mocked(getProfile),
  updateProfile: vi.mocked(updateProfile),
  verifyTotp: vi.mocked(verifyTotp),
}

function profile(over: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'USER',
    totpEnabled: false,
    createdAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

async function mountView() {
  const wrapper = mount(AccountView, {
    global: {
      plugins: [createPinia()],
      stubs: { RouterLink: true },
    },
  })
  await flushPromises()
  return wrapper
}

describe('accountView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocked.getProfile.mockResolvedValue(profile())
  })

  it('renders the current profile', async () => {
    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="account-profile-name"]').text()).toBe('Ada Lovelace')
    expect(wrapper.get('[data-testid="account-email"]').text()).toBe('ada@example.test')
  })

  it('shows the credential login cards on the Credentials tab', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="credentials-card-claude"]').exists()).toBe(false)

    await wrapper.get('[data-testid="account-tab-credentials"]').trigger('click')

    expect(wrapper.find('[data-testid="credentials-card-claude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-card-codex"]').exists()).toBe(true)
  })

  it('submits profile edits', async () => {
    mocked.updateProfile.mockResolvedValue(profile({ firstName: 'Grace', lastName: 'Hopper' }))
    const wrapper = await mountView()

    await wrapper.get('[data-testid="account-profile-edit"]').trigger('click')
    await wrapper.get('[data-testid="account-first-name"]').setValue('Grace')
    await wrapper.get('[data-testid="account-last-name"]').setValue('Hopper')
    await wrapper.get('[data-testid="account-profile-form"]').trigger('submit')
    await flushPromises()

    expect(mocked.updateProfile).toHaveBeenCalledWith({ firstName: 'Grace', lastName: 'Hopper' })
    expect(wrapper.get('[data-testid="account-profile-name"]').text()).toBe('Grace Hopper')
  })

  it('validates and submits password changes', async () => {
    mocked.changePassword.mockResolvedValue()
    const wrapper = await mountView()

    await wrapper.get('[data-testid="account-current-password"]').setValue('old-password')
    await wrapper.get('[data-testid="account-new-password"]').setValue('new-password-123')
    await wrapper.get('[data-testid="account-confirm-password"]').setValue('new-password-123')
    await wrapper.get('[data-testid="account-password-form"]').trigger('submit')
    await flushPromises()

    expect(mocked.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    })
  })

  it('blocks mismatched password confirmation', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-testid="account-current-password"]').setValue('old-password')
    await wrapper.get('[data-testid="account-new-password"]').setValue('new-password-123')
    await wrapper.get('[data-testid="account-confirm-password"]').setValue('different-password')
    await wrapper.get('[data-testid="account-password-form"]').trigger('submit')
    await flushPromises()

    expect(mocked.changePassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Passwords do not match')
  })

  it('runs the totp enrollment and verification flow', async () => {
    mocked.enrollTotp.mockResolvedValue({ secret: 'SECRET', qrUri: 'otpauth://totp/demo' })
    mocked.verifyTotp.mockResolvedValue()
    const wrapper = await mountView()

    await wrapper.get('[data-testid="account-totp-enroll"]').trigger('click')
    await flushPromises()

    expect(mocked.enrollTotp).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="account-totp-uri"]').text()).toBe('otpauth://totp/demo')
    expect(wrapper.get('[data-testid="account-totp-secret"]').text()).toBe('SECRET')

    await wrapper.get('[data-testid="account-totp-code"]').setValue('123456')
    await wrapper.get('[data-testid="account-totp-verify-form"]').trigger('submit')
    await flushPromises()

    expect(mocked.verifyTotp).toHaveBeenCalledWith({ code: '123456' })
    expect(wrapper.get('[data-testid="account-totp-enabled"]').text()).toBe('Enabled')
  })
})
