<script setup lang="ts">
import type { ZodIssue } from 'zod'
import { computed, reactive, ref } from 'vue'
import { z } from 'zod'
import { FormErrors, FormField, SubmitButton, useMutationState, useToast } from '@/lib/vueWebCommons'
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
const fieldErrors = reactive<Record<string, string>>({})
const generalError = ref<string | null>(null)
const submittedEmail = ref('')
const resendMessage = ref<string | null>(null)
const submit = useMutationState<void>()
const resend = useMutationState<void>()
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
  generalError.value = null
  Object.keys(fieldErrors).forEach((key) => {
    delete fieldErrors[key]
  })
}

function fieldErrorFor(name: string): string | null {
  return fieldErrors[name] ?? null
}

function captureIssues(issues: ZodIssue[]): void {
  issues.forEach((issue) => {
    const [path] = issue.path
    if (typeof path === 'string' && fieldErrors[path] === undefined) fieldErrors[path] = issue.message
  })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'The request could not be completed.'
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
    generalError.value = errorMessage(e)
    toast.error('Registration failed', generalError.value)
  }
}

async function onResend(): Promise<void> {
  resendMessage.value = null
  try {
    await resend.run(() => resendConfirmation(submittedEmail.value))
    resendMessage.value = 'Confirmation email sent.'
    toast.success('Confirmation email sent', 'Check your inbox for the latest link.')
  } catch (e) {
    generalError.value = errorMessage(e)
    toast.error('Could not resend confirmation', generalError.value)
  }
}
</script>

<template>
  <AuthCard
    v-if="submittedEmail"
    title="Check your email"
    :subtitle="`We sent a confirmation link to ${submittedEmail}. Confirm your email before signing in.`"
  >
    <FormErrors :error="generalError" />
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
      <FormErrors :error="generalError" />

      <FormField label="Username" required :error="fieldErrorFor('username')">
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

      <FormField label="Email" required :error="fieldErrorFor('email')">
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

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" required :error="fieldErrorFor('firstName')">
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

        <FormField label="Last name" required :error="fieldErrorFor('lastName')">
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

      <PasswordFields
        v-model:password="form.password"
        v-model:confirm-password="form.confirmPassword"
        :password-error="fieldErrorFor('password')"
        :confirm-password-error="fieldErrorFor('confirmPassword')"
      />

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
