<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FormErrors, FormField, SubmitButton, useMutationState, useToast } from '@/lib/vueWebCommons'
import AuthCard from '../components/AuthCard.vue'
import { confirmEmail, resendConfirmation } from '../services/signupService'
import { resendConfirmationRequestSchema } from '../types'

type ConfirmationState = 'confirming' | 'success' | 'failure'

const route = useRoute()
const state = ref<ConfirmationState>('confirming')
const email = ref('')
const fieldError = ref<string | null>(null)
const generalError = ref<string | null>(null)
const resendMessage = ref<string | null>(null)
const resend = useMutationState<void>()
const toast = useToast()

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value : ''
})

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Email confirmation failed.'
}

onMounted(async () => {
  if (!token.value) {
    state.value = 'failure'
    generalError.value = 'Confirmation token is missing.'
    return
  }

  try {
    await confirmEmail(token.value)
    state.value = 'success'
  } catch (e) {
    state.value = 'failure'
    generalError.value = errorMessage(e)
  }
})

async function onResend(): Promise<void> {
  fieldError.value = null
  generalError.value = null
  resendMessage.value = null
  const parsed = resendConfirmationRequestSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    fieldError.value = parsed.error.issues[0]?.message ?? 'Enter a valid email address'
    return
  }

  try {
    await resend.run(() => resendConfirmation(parsed.data.email))
    resendMessage.value = 'Confirmation email sent.'
    toast.success('Confirmation email sent', 'Check your inbox for the latest link.')
  } catch (e) {
    generalError.value = errorMessage(e)
    toast.error('Could not resend confirmation', generalError.value)
  }
}
</script>

<template>
  <AuthCard title="Confirm email">
    <div v-if="state === 'confirming'" class="text-sm text-[var(--color-text-muted)]" data-testid="confirm-loading">
      Confirming your email…
    </div>

    <div v-else-if="state === 'success'" class="space-y-4" data-testid="confirm-success">
      <p>Your email is confirmed. You can now sign in.</p>
      <RouterLink to="/" class="text-sm text-[var(--color-accent-light)] underline">Go to login</RouterLink>
    </div>

    <div v-else class="space-y-4" data-testid="confirm-failure">
      <FormErrors :error="generalError" />
      <p class="text-sm text-[var(--color-text-muted)]">
        The confirmation link is invalid or expired. Enter your email to receive a new link.
      </p>
      <form class="space-y-4" @submit.prevent="onResend">
        <FormField label="Email" required :error="fieldError">
          <template #default="{ id, invalid }">
            <input
              :id="id"
              v-model="email"
              type="email"
              required
              :aria-invalid="invalid"
              class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
              data-testid="confirm-email"
            />
          </template>
        </FormField>
        <p v-if="resendMessage" class="text-sm text-green-400" data-testid="confirm-resend-success">
          {{ resendMessage }}
        </p>
        <SubmitButton
          label="Resend confirmation"
          :status="resend.status.value"
          :disabled="resend.pending.value"
          data-testid="confirm-resend"
        />
      </form>
    </div>
  </AuthCard>
</template>
