<script setup lang="ts">
import type { ZodIssue } from 'zod'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { z } from 'zod'
import { FormErrors, SubmitButton, useMutationState, useToast } from '@/lib/vueWebCommons'
import AuthCard from '../components/AuthCard.vue'
import PasswordFields from '../components/PasswordFields.vue'
import { resetPassword } from '../services/signupService'
import { resetPasswordRequestSchema } from '../types'

const route = useRoute()
const form = reactive({
  newPassword: '',
  confirmPassword: '',
})
const fieldErrors = reactive<Record<string, string>>({})
const generalError = ref<string | null>(null)
const success = ref(false)
const submit = useMutationState<void>()
const toast = useToast()

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})
const resetFormSchema = resetPasswordRequestSchema.extend({
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
})
const canSubmit = computed(() => form.newPassword.length > 0 && form.confirmPassword.length > 0 && token.value.length > 0)

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
  return 'Password reset failed.'
}

async function onSubmit(): Promise<void> {
  clearErrors()
  const parsed = resetFormSchema.safeParse({
    token: token.value,
    newPassword: form.newPassword,
    confirmPassword: form.confirmPassword,
  })
  if (!parsed.success) {
    captureIssues(parsed.error.issues)
    return
  }

  try {
    await submit.run(() => resetPassword(parsed.data.token, parsed.data.newPassword))
    success.value = true
  } catch (e) {
    generalError.value = errorMessage(e)
    toast.error('Password reset failed', generalError.value)
  }
}
</script>

<template>
  <AuthCard title="Choose a new password">
    <div v-if="success" class="space-y-4" data-testid="reset-success">
      <p>Your password has been reset. You can now sign in.</p>
      <RouterLink to="/" class="text-sm text-[var(--color-accent-light)] underline">Go to login</RouterLink>
    </div>

    <div v-else-if="!token" class="space-y-4" data-testid="reset-missing-token">
      <FormErrors error="Reset token is missing." />
      <RouterLink to="/forgot-password" class="text-sm text-[var(--color-accent-light)] underline">
        Request a new reset link
      </RouterLink>
    </div>

    <form v-else class="space-y-4" data-testid="reset-form" @submit.prevent="onSubmit">
      <FormErrors :error="generalError" />
      <PasswordFields
        v-model:password="form.newPassword"
        v-model:confirm-password="form.confirmPassword"
        password-label="New password"
        :password-error="fieldErrorFor('newPassword')"
        :confirm-password-error="fieldErrorFor('confirmPassword')"
      />
      <SubmitButton
        label="Reset password"
        :status="submit.status.value"
        :disabled="!canSubmit"
        data-testid="reset-submit"
      />
    </form>
  </AuthCard>
</template>
