<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  FormErrors,
  FormField,
  SubmitButton,
  useAuth,
  useFormErrors,
  useMutationState,
  useToast,
} from '@/lib/vueWebCommons'
import { AuthApiError, sessionLogin } from '../services/authLoginService'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const toast = useToast()
const submit = useMutationState<void>()
const formErrors = useFormErrors()

const username = ref('')
const password = ref('')
const totpCode = ref('')
const totpRequired = ref(false)

const canSubmit = computed(() =>
  username.value.trim().length > 0
  && password.value.length > 0
  && (!totpRequired.value || totpCode.value.trim().length > 0),
)

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) return

  formErrors.clear()
  try {
    await submit.run(async () => {
      const response = await sessionLogin({
        username: username.value.trim(),
        password: password.value,
        totpCode: totpRequired.value ? totpCode.value.trim() : undefined,
      })

      if (response.totpRequired && !totpCode.value.trim()) {
        totpRequired.value = true
        return
      }
      if (!response.success) {
        throw new AuthApiError('Sign in failed', 401)
      }

      await auth.fetchUser()
      await router.push(sanitizedRedirect(route.query.redirect) ?? { name: 'sessions' })
    })
  } catch (e) {
    formErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not sign in', e)
  }
}

function sanitizedRedirect(value: unknown): string | null {
  const redirect = Array.isArray(value) ? value[0] : value
  if (typeof redirect !== 'string') return null
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return null
  if (redirect.startsWith('/login')) return null

  return redirect
}
</script>

<template>
  <main class="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md items-center px-6 py-10" data-testid="login-view">
    <form
      class="w-full space-y-5 rounded-lg border border-[var(--color-surface-border)]
        bg-[var(--color-surface-card)] p-6 shadow-lg"
      data-testid="login-form"
      @submit.prevent="onSubmit"
    >
      <header class="space-y-1">
        <h1 class="text-2xl font-bold">Sign in</h1>
        <p class="text-sm text-[var(--color-text-muted)]">Use your account password and authenticator code.</p>
      </header>

      <FormErrors :error="formErrors.general.value" />

      <FormField label="Username" required :error="formErrors.fieldErrorFor('username')">
        <template #default="{ id, invalid, describedBy }">
          <input
            :id="id"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)]
              bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
            data-testid="login-username"
          />
        </template>
      </FormField>

      <FormField label="Password" required :error="formErrors.fieldErrorFor('password')">
        <template #default="{ id, invalid, describedBy }">
          <input
            :id="id"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)]
              bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
            data-testid="login-password"
          />
        </template>
      </FormField>

      <FormField
        v-if="totpRequired"
        label="Authenticator code"
        required
        :error="formErrors.fieldErrorFor('totpCode') ?? formErrors.fieldErrorFor('totp_code')"
      >
        <template #default="{ id, invalid, describedBy }">
          <input
            :id="id"
            v-model="totpCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
            maxlength="8"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)]
              bg-[var(--color-surface-elevated)] px-3 py-2 font-mono text-sm"
            data-testid="login-totp"
          />
        </template>
      </FormField>

      <SubmitButton
        class="w-full"
        :label="totpRequired ? 'Verify code' : 'Sign in'"
        :status="submit.status.value"
        :disabled="!canSubmit"
        data-testid="login-submit"
      />

      <nav class="flex justify-between text-sm">
        <RouterLink class="text-[var(--color-accent-light)] underline" to="/register">Create account</RouterLink>
        <RouterLink class="text-[var(--color-accent-light)] underline" to="/forgot-password">
          Forgot password?
        </RouterLink>
      </nav>
    </form>
  </main>
</template>
