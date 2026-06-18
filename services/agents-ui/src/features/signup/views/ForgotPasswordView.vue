<script setup lang="ts">
import { ref } from 'vue'
import { FormErrors, FormField, SubmitButton, useFormErrors, useMutationState, useToast } from '@/lib/vueWebCommons'
import AuthCard from '../components/AuthCard.vue'
import { forgotPassword } from '../services/signupService'
import { forgotPasswordRequestSchema } from '../types'

const email = ref('')
const validationEmailError = ref<string>()
const sent = ref(false)
const submit = useMutationState<void>()
const formErrors = useFormErrors()
const toast = useToast()

async function onSubmit(): Promise<void> {
  validationEmailError.value = undefined
  formErrors.clear()
  const parsed = forgotPasswordRequestSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    validationEmailError.value = parsed.error.issues[0]?.message ?? 'Enter a valid email address'
    return
  }

  try {
    await submit.run(() => forgotPassword(parsed.data.email))
    sent.value = true
  } catch (e) {
    formErrors.captureFromCatch(e)
    toast.errorFromCatch('Reset request failed', e)
  }
}
</script>

<template>
  <AuthCard
    title="Reset password"
    subtitle="Enter your email and we will send reset instructions if an account exists."
  >
    <div v-if="sent" class="space-y-4" data-testid="forgot-success">
      <p>If the account exists, a reset link was sent.</p>
      <RouterLink to="/" class="text-sm text-[var(--color-accent-light)] underline">Back to login</RouterLink>
    </div>

    <form v-else class="space-y-4" data-testid="forgot-form" @submit.prevent="onSubmit">
      <FormErrors :error="formErrors.general.value" />
      <FormField label="Email" required :error="formErrors.fieldErrorFor('email')">
        <template #default="{ id, invalid }">
          <input
            :id="id"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :aria-invalid="invalid"
            class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
            data-testid="forgot-email"
          />
        </template>
      </FormField>
      <p v-if="validationEmailError" class="-mt-2 text-xs text-red-300">
        {{ validationEmailError }}
      </p>
      <SubmitButton
        label="Send reset link"
        :status="submit.status.value"
        :disabled="submit.pending.value"
        data-testid="forgot-submit"
      />
    </form>
  </AuthCard>
</template>
