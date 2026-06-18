<script setup lang="ts">
import { FormField } from '@/lib/vueWebCommons'

defineProps<{
  passwordError?: string | undefined
  confirmPasswordError?: string | undefined
  passwordLabel?: string | undefined
}>()

const password = defineModel<string>('password', { required: true })
const confirmPassword = defineModel<string>('confirmPassword', { required: true })
</script>

<template>
  <FormField :label="passwordLabel ?? 'Password'" required :error="passwordError">
    <template #default="{ id, invalid }">
      <input
        :id="id"
        v-model="password"
        type="password"
        autocomplete="new-password"
        required
        :aria-invalid="invalid"
        class="w-full rounded border border-[var(--color-surface-border)] bg-black/20 px-3 py-2"
        data-testid="signup-password"
      />
    </template>
  </FormField>

  <FormField label="Confirm password" required :error="confirmPasswordError">
    <template #default="{ id, invalid }">
      <input
        :id="id"
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
        required
        :aria-invalid="invalid"
        class="w-full rounded border border-[var(--color-surface-border)] bg-black/20 px-3 py-2"
        data-testid="signup-confirm-password"
      />
    </template>
  </FormField>
</template>
