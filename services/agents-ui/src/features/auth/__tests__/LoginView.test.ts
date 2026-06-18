import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AuthApiError, sessionLogin } from '../services/authLoginService'
import LoginView from '../views/LoginView.vue'

const fetchUserMock = vi.fn(async () => undefined)
const toastErrorMock = vi.fn()
let formErrors: ReturnType<typeof createFormErrors>

vi.mock('../services/authLoginService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authLoginService')>()
  return {
    ...actual,
    sessionLogin: vi.fn(),
  }
})

vi.mock('@/lib/vueWebCommons', async () => {
  const { defineComponent, h, ref } = await import('vue')

  return {
    FormErrors: defineComponent({
      name: 'FormErrors',
      props: {
        error: { type: String, default: null },
      },
      setup(props) {
        return () => props.error ? h('p', { 'data-testid': 'form-error' }, props.error) : null
      },
    }),
    FormField: defineComponent({
      name: 'FormField',
      props: {
        error: { type: String, default: null },
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
      },
      setup(props, { slots }) {
        return () => h('label', [
          h('span', props.label),
          slots.default?.({ id: props.label, invalid: Boolean(props.error), describedBy: undefined }),
          props.error ? h('small', props.error) : null,
        ])
      },
    }),
    SubmitButton: defineComponent({
      name: 'SubmitButton',
      props: {
        disabled: { type: Boolean, default: false },
        label: { type: String, required: true },
        status: { type: String, default: 'idle' },
      },
      setup(props) {
        return () => h('button', {
          'data-testid': 'login-submit',
          'disabled': props.disabled,
          'type': 'submit',
        }, props.label)
      },
    }),
    useAuth: () => ({
      fetchUser: fetchUserMock,
    }),
    useFormErrors: () => formErrors,
    useMutationState: () => {
      const status = ref('idle')
      const pending = ref(false)
      return {
        pending,
        status,
        run: async (callback: () => Promise<void>) => {
          pending.value = true
          status.value = 'pending'
          try {
            await callback()
            status.value = 'success'
          } catch (e) {
            status.value = 'failure'
            throw e
          } finally {
            pending.value = false
          }
        },
      }
    },
    useToast: () => ({
      errorFromCatch: toastErrorMock,
    }),
  }
})

describe('login view', () => {
  beforeEach(() => {
    vi.mocked(sessionLogin).mockReset()
    fetchUserMock.mockClear()
    toastErrorMock.mockClear()
    formErrors = createFormErrors()
  })

  it('submits credentials, hydrates auth, and redirects to a sanitized path', async () => {
    vi.mocked(sessionLogin).mockResolvedValueOnce({ success: true, totpRequired: false })
    const { router, wrapper } = await mountLogin('/login?redirect=/projects%3Ffilter%3Dopen')

    await wrapper.get('[data-testid="login-username"]').setValue('alice')
    await wrapper.get('[data-testid="login-password"]').setValue('secret')
    await wrapper.get('[data-testid="login-form"]').trigger('submit')
    await flushPromises()

    expect(sessionLogin).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
      totpCode: undefined,
    })
    expect(fetchUserMock).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.fullPath).toBe('/projects?filter=open')
  })

  it('handles totp required as a two-step submit', async () => {
    vi.mocked(sessionLogin)
      .mockResolvedValueOnce({ success: false, totpRequired: true })
      .mockResolvedValueOnce({ success: true, totpRequired: false })
    const { wrapper } = await mountLogin()

    await wrapper.get('[data-testid="login-username"]').setValue('alice')
    await wrapper.get('[data-testid="login-password"]').setValue('secret')
    await wrapper.get('[data-testid="login-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="login-totp"]').exists()).toBe(true)
    expect(fetchUserMock).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="login-totp"]').setValue('123456')
    await wrapper.get('[data-testid="login-form"]').trigger('submit')
    await flushPromises()

    expect(sessionLogin).toHaveBeenLastCalledWith({
      username: 'alice',
      password: 'secret',
      totpCode: '123456',
    })
    expect(fetchUserMock).toHaveBeenCalledTimes(1)
  })

  it('shows auth api errors through form errors and toast', async () => {
    const error = new AuthApiError('Invalid credentials', 401)
    vi.mocked(sessionLogin).mockRejectedValueOnce(error)
    const { wrapper } = await mountLogin()

    await wrapper.get('[data-testid="login-username"]').setValue('alice')
    await wrapper.get('[data-testid="login-password"]').setValue('wrong')
    await wrapper.get('[data-testid="login-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="form-error"]').text()).toBe('Invalid credentials')
    expect(toastErrorMock).toHaveBeenCalledWith('Could not sign in', error)
  })
})

async function mountLogin(path = '/login'): Promise<{ router: ReturnType<typeof createRouter>; wrapper: VueWrapper }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/sessions', name: 'sessions', component: stubView('sessions') },
      { path: '/projects', name: 'projects', component: stubView('projects') },
    ],
  })
  await router.push(path)
  await router.isReady()

  const wrapper = mount(LoginView, {
    global: {
      plugins: [router],
    },
  })

  return { router, wrapper }
}

function createFormErrors() {
  const general = ref<string | null>(null)
  return {
    general,
    clear: vi.fn(() => {
      general.value = null
    }),
    captureFromCatch: vi.fn((e: unknown) => {
      general.value = e instanceof Error ? e.message : 'Something went wrong'
    }),
    fieldErrorFor: vi.fn(() => null),
  }
}

function stubView(testid: string) {
  return defineComponent({
    name: 'StubView',
    setup() {
      return () => h('div', { 'data-testid': testid })
    },
  })
}
