import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import ConfirmEmailView from '../views/ConfirmEmailView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import RegisterView from '../views/RegisterView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastErrorFromCatch: vi.fn(),
  register: vi.fn(),
  confirmEmail: vi.fn(),
  resendConfirmation: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock('@/lib/vueWebCommons', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')

  return {
    FormErrors: {
      props: ['error'],
      template: '<p v-if="error" data-testid="form-error">{{ typeof error === "string" ? error : error.message }}</p>',
    },
    FormField: {
      props: ['label', 'error'],
      template: '<label><span>{{ label }}</span><slot :id="label" :invalid="Boolean(error)" /><small v-if="error">{{ error }}</small></label>',
    },
    SubmitButton: {
      props: ['disabled', 'label', 'status', 'type'],
      emits: ['click'],
      template: '<button v-bind="$attrs" :type="type || \'submit\'" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
    },
    useFormErrors: () => {
      const general = ref<string | null>(null)
      const fields = ref<Record<string, string>>({})
      return {
        general,
        clear: () => {
          general.value = null
          fields.value = {}
        },
        fieldErrorFor: (name: string) => fields.value[name],
        captureFromCatch: (error: unknown) => {
          general.value = error instanceof Error ? error.message : 'The request could not be completed.'
        },
      }
    },
    useMutationState: () => ({
      pending: { value: false },
      status: { value: 'idle' },
      run: async (fn: () => Promise<void>) => fn(),
    }),
    useToast: () => ({
      success: mocks.toastSuccess,
      errorFromCatch: mocks.toastErrorFromCatch,
    }),
  }
})

vi.mock('../services/signupService', () => ({
  register: (...args: unknown[]) => mocks.register(...args),
  confirmEmail: (...args: unknown[]) => mocks.confirmEmail(...args),
  resendConfirmation: (...args: unknown[]) => mocks.resendConfirmation(...args),
  forgotPassword: (...args: unknown[]) => mocks.forgotPassword(...args),
  resetPassword: (...args: unknown[]) => mocks.resetPassword(...args),
}))

async function mountWithRouter(component: Component, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/register', component: RegisterView },
      { path: '/forgot-password', component: ForgotPasswordView },
      { path: '/confirm-email', component: ConfirmEmailView },
      { path: '/reset-password', component: ResetPasswordView },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, { global: { plugins: [router] } })
  await flush()
  return wrapper
}

describe('signup views', () => {
  beforeEach(() => {
    mocks.toastSuccess.mockReset()
    mocks.toastErrorFromCatch.mockReset()
    mocks.register.mockReset()
    mocks.confirmEmail.mockReset()
    mocks.resendConfirmation.mockReset()
    mocks.forgotPassword.mockReset()
    mocks.resetPassword.mockReset()
  })

  it('validates registration, submits, and shows confirm sent state', async () => {
    mocks.register.mockResolvedValue(undefined)
    const wrapper = await mountWithRouter(RegisterView, '/register')

    await wrapper.get('[data-testid="register-username"]').setValue('ada')
    await wrapper.get('[data-testid="register-email"]').setValue('ada@example.test')
    await wrapper.get('[data-testid="register-first-name"]').setValue('Ada')
    await wrapper.get('[data-testid="register-last-name"]').setValue('Lovelace')
    await wrapper.get('[data-testid="signup-password"]').setValue('password1')
    await wrapper.get('[data-testid="signup-confirm-password"]').setValue('password1')
    await wrapper.get('[data-testid="register-form"]').trigger('submit')
    await flush()

    expect(mocks.register).toHaveBeenCalledWith({
      username: 'ada',
      email: 'ada@example.test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'password1',
    })
    expect(wrapper.text()).toContain('Check your email')
    expect(wrapper.text()).toContain('ada@example.test')
  })

  it('keeps registration on the form when passwords do not match', async () => {
    const wrapper = await mountWithRouter(RegisterView, '/register')

    await wrapper.get('[data-testid="register-username"]').setValue('ada')
    await wrapper.get('[data-testid="register-email"]').setValue('ada@example.test')
    await wrapper.get('[data-testid="register-first-name"]').setValue('Ada')
    await wrapper.get('[data-testid="register-last-name"]').setValue('Lovelace')
    await wrapper.get('[data-testid="signup-password"]').setValue('password1')
    await wrapper.get('[data-testid="signup-confirm-password"]').setValue('password2')
    await wrapper.get('[data-testid="register-form"]').trigger('submit')
    await flush()

    expect(mocks.register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Passwords must match')
  })

  it('surfaces registration errors inline and in toast', async () => {
    mocks.register.mockRejectedValue(new Error('email already exists'))
    const wrapper = await mountWithRouter(RegisterView, '/register')

    await wrapper.get('[data-testid="register-username"]').setValue('ada')
    await wrapper.get('[data-testid="register-email"]').setValue('ada@example.test')
    await wrapper.get('[data-testid="register-first-name"]').setValue('Ada')
    await wrapper.get('[data-testid="register-last-name"]').setValue('Lovelace')
    await wrapper.get('[data-testid="signup-password"]').setValue('password1')
    await wrapper.get('[data-testid="signup-confirm-password"]').setValue('password1')
    await wrapper.get('[data-testid="register-form"]').trigger('submit')
    await flush()

    expect(wrapper.text()).toContain('email already exists')
    expect(mocks.toastErrorFromCatch).toHaveBeenCalledWith('Registration failed', expect.any(Error))
  })

  it('confirms email from route query and renders success', async () => {
    mocks.confirmEmail.mockResolvedValue(undefined)
    const wrapper = await mountWithRouter(ConfirmEmailView, '/confirm-email?token=abc')

    await vi.waitFor(() => {
      expect(mocks.confirmEmail).toHaveBeenCalledWith('abc')
      expect(wrapper.get('[data-testid="confirm-success"]').text()).toContain('confirmed')
    })
  })

  it('renders confirm failure and offers resend when confirmation fails', async () => {
    mocks.confirmEmail.mockRejectedValue(new Error('expired'))
    mocks.resendConfirmation.mockResolvedValue(undefined)
    const wrapper = await mountWithRouter(ConfirmEmailView, '/confirm-email?token=expired')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="confirm-failure"]').text()).toContain('expired')
    })
    await wrapper.get('[data-testid="confirm-email"]').setValue('ada@example.test')
    await wrapper.get('form').trigger('submit')
    await flush()

    expect(mocks.resendConfirmation).toHaveBeenCalledWith('ada@example.test')
    expect(wrapper.text()).toContain('Confirmation email sent.')
  })

  it('forgot password submits email and renders neutral success', async () => {
    mocks.forgotPassword.mockResolvedValue(undefined)
    const wrapper = await mountWithRouter(ForgotPasswordView, '/forgot-password')

    await wrapper.get('[data-testid="forgot-email"]').setValue('ada@example.test')
    await wrapper.get('[data-testid="forgot-form"]').trigger('submit')
    await flush()

    expect(mocks.forgotPassword).toHaveBeenCalledWith('ada@example.test')
    expect(wrapper.get('[data-testid="forgot-success"]').text()).toContain('If the account exists')
  })

  it('reset password validates match and submits token with new password', async () => {
    mocks.resetPassword.mockResolvedValue(undefined)
    const wrapper = await mountWithRouter(ResetPasswordView, '/reset-password?token=reset-1')

    await wrapper.get('[data-testid="signup-password"]').setValue('password1')
    await wrapper.get('[data-testid="signup-confirm-password"]').setValue('password2')
    await wrapper.get('[data-testid="reset-form"]').trigger('submit')
    await flush()

    expect(mocks.resetPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Passwords must match')

    await wrapper.get('[data-testid="signup-confirm-password"]').setValue('password1')
    await wrapper.get('[data-testid="reset-form"]').trigger('submit')
    await flush()

    expect(mocks.resetPassword).toHaveBeenCalledWith('reset-1', 'password1')
    expect(wrapper.get('[data-testid="reset-success"]').text()).toContain('password has been reset')
  })
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
