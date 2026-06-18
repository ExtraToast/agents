<script setup lang="ts">
import type { ZodIssue } from 'zod'
import { computed, reactive, ref } from 'vue'
import { z } from 'zod'
import { FormErrors, FormField, SubmitButton, useFormErrors, useMutationState, useToast } from '@/lib/vueWebCommons'
import AuthCard from '../components/AuthCard.vue'
import PasswordFields from '../components/PasswordFields.vue'
import { register, resendConfirmation } from '../services/signupService'
import { registerUserRequestSchema } from '../types'

const form = reactive({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
})
const validationErrors = ref<Record<string, string>>({})
const submittedEmail = ref('')
const resendMessage = ref<string | null>(null)
const submit = useMutationState<void>()
const resend = useMutationState<void>()
const formErrors = useFormErrors()
const toast = useToast()

const registerFormSchema = registerUserRequestSchema.extend({
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
})

const canSubmit = computed(() =>
  form.username.trim().length > 0
  && form.email.trim().length > 0
  && form.firstName.trim().length > 0
  && form.lastName.trim().length > 0
  && form.password.length > 0
  && form.confirmPassword.length > 0,
)

function clearErrors(): void {
  formErrors.clear()
  validationErrors.value = {}
}

function captureIssues(issues: ZodIssue[]): void {
  const errors: Record<string, string> = {}
  issues.forEach((issue) => {
    const [path] = issue.path
    if (typeof path === 'string' && errors[path] === undefined) errors[path] = issue.message
  })
  validationErrors.value = errors
}

async function onSubmit(): Promise<void> {
  clearErrors()
  const parsed = registerFormSchema.safeParse(form)
  if (!parsed.success) {
    captureIssues(parsed.error.issues)
    return
  }

  try {
    await submit.run(() => register({
      username: parsed.data.username,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      password: parsed.data.password,
    }))
    submittedEmail.value = parsed.data.email
  } catch (e) {
    formErrors.captureFromCatch(e)
    toast.errorFromCatch('Registration failed', e)
  }
}

async function onResend(): Promise<void> {
  formErrors.clear()
  resendMessage.value = null
  try {
    await resend.run(() => resendConfirmation(submittedEmail.value))
    resendMessage.value = 'Confirmation email sent.'
    toast.success('Confirmation email sent', 'Check your inbox for the latest link.')
  } catch (e) {
    formErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not resend confirmation', e)
  }
}
</script>

<template>
  <AuthCard
    v-if="submittedEmail"
    title="Check your email"
    :subtitle="`We sent a confirmation link to ${submittedEmail}. Confirm your email before signing in.`"
  >
    <FormErrors :error="formErrors.general.value" />
    <p v-if="resendMessage" class="mb-4 text-sm text-green-400" data-testid="register-resend-success">
      {{ resendMessage }}
    </p>
    <SubmitButton
      label="Resend confirmation"
      :status="resend.status.value"
      :disabled="resend.pending.value"
      data-testid="register-resend"
      @click="onResend"
    />
  </AuthCard>

  <AuthCard v-else title="Create account" subtitle="Register, then confirm your email to activate the account.">
    <form class="space-y-4" data-testid="register-form" @submit.prevent="onSubmit">
      <FormErrors :error="formErrors.general.value" />

      <FormField label="Username" required :error="formErrors.fieldErrorFor('username')">
        <template #default="{ id, invalid }">
          <input
            :id="id"
            v-model="form.username"
            type="text"
            autocomplete="username"
            required
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
            data-testid="register-username"
          />
        </template>
      </FormField>
      <p v-if="validationErrors.username" class="-mt-2 text-xs text-red-300">
        {{ validationErrors.username }}
      </p>

      <FormField label="Email" required :error="formErrors.fieldErrorFor('email')">
        <template #default="{ id, invalid }">
          <input
            :id="id"
            v-model="form.email"
            type="email"
            autocomplete="email"
            required
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
            data-testid="register-email"
          />
        </template>
      </FormField>
      <p v-if="validationErrors.email" class="-mt-2 text-xs text-red-300">
        {{ validationErrors.email }}
      </p>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" required :error="formErrors.fieldErrorFor('firstName')">
          <template #default="{ id, invalid }">
            <input
              :id="id"
              v-model="form.firstName"
              type="text"
              autocomplete="given-name"
              required
              :aria-invalid="invalid"
              class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
              data-testid="register-first-name"
            />
          </template>
        </FormField>

        <FormField label="Last name" required :error="formErrors.fieldErrorFor('lastName')">
          <template #default="{ id, invalid }">
            <input
              :id="id"
              v-model="form.lastName"
              type="text"
              autocomplete="family-name"
              required
              :aria-invalid="invalid"
              class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
              data-testid="register-last-name"
            />
          </template>
        </FormField>
      </div>
      <p v-if="validationErrors.firstName || validationErrors.lastName" class="-mt-2 text-xs text-red-300">
        {{ validationErrors.firstName ?? validationErrors.lastName }}
      </p>

      <PasswordFields
        v-model:password="form.password"
        v-model:confirm-password="form.confirmPassword"
        :password-error="formErrors.fieldErrorFor('password')"
        :confirm-password-error="formErrors.fieldErrorFor('confirmPassword')"
      />
      <p v-if="validationErrors.password || validationErrors.confirmPassword" class="-mt-2 text-xs text-red-300">
        {{ validationErrors.password ?? validationErrors.confirmPassword }}
      </p>

      <div class="flex items-center justify-between gap-3">
        <RouterLink to="/forgot-password" class="text-sm text-[var(--color-accent-light)] underline">
          Forgot password?
        </RouterLink>
        <SubmitButton
          label="Create account"
          :status="submit.status.value"
          :disabled="!canSubmit"
          data-testid="register-submit"
        />
      </div>
    </form>
  </AuthCard>
</template>
