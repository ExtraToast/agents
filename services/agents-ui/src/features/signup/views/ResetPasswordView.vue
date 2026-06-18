<script setup lang="ts">
import type { ZodIssue } from 'zod'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { z } from 'zod'
import { FormErrors, SubmitButton, useFormErrors, useMutationState, useToast } from '@/lib/vueWebCommons'
import AuthCard from '../components/AuthCard.vue'
import PasswordFields from '../components/PasswordFields.vue'
import { resetPassword } from '../services/signupService'
import { resetPasswordRequestSchema } from '../types'

const route = useRoute()
const form = reactive({
  newPassword: '',
  confirmPassword: '',
})
const validationErrors = ref<Record<string, string>>({})
const success = ref(false)
const submit = useMutationState<void>()
const formErrors = useFormErrors()
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
const canSubmit = computed(
  () => form.newPassword.length > 0 && form.confirmPassword.length > 0 && token.value.length > 0,
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
    formErrors.captureFromCatch(e)
    toast.errorFromCatch('Password reset failed', e)
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
      <p class="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        Reset token is missing.
      </p>
      <RouterLink to="/forgot-password" class="text-sm text-[var(--color-accent-light)] underline">
        Request a new reset link
      </RouterLink>
    </div>

    <form v-else class="space-y-4" data-testid="reset-form" @submit.prevent="onSubmit">
      <FormErrors :error="formErrors.general.value" />
      <PasswordFields
        v-model:password="form.newPassword"
        v-model:confirm-password="form.confirmPassword"
        password-label="New password"
        :password-error="formErrors.fieldErrorFor('newPassword')"
        :confirm-password-error="formErrors.fieldErrorFor('confirmPassword')"
      />
      <p v-if="validationErrors.newPassword || validationErrors.confirmPassword" class="-mt-2 text-xs text-red-300">
        {{ validationErrors.newPassword ?? validationErrors.confirmPassword }}
      </p>
      <SubmitButton
        label="Reset password"
        :status="submit.status.value"
        :disabled="!canSubmit"
        data-testid="reset-submit"
      />
    </form>
  </AuthCard>
</template>
