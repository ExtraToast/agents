<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'
import { FormErrors, FormField, SubmitButton, useFormErrors, useMutationState, useToast } from '@/lib/vueWebCommons'
import { useAccountStore } from '../stores/account'
import { changePasswordRequestSchema, totpVerifyRequestSchema, updateProfileRequestSchema } from '../types'

const store = useAccountStore()
const toast = useToast()

const profileForm = reactive({
  firstName: '',
  lastName: '',
})
const passwordForm = reactive({
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
})
const verifyCode = ref('')
const editingProfile = ref(false)
const profileValidation = ref<Record<string, string>>({})
const passwordValidation = ref<Record<string, string>>({})
const totpValidation = ref<Record<string, string>>({})

const loadErrors = useFormErrors()
const profileErrors = useFormErrors()
const passwordErrors = useFormErrors()
const totpErrors = useFormErrors()
const profileSubmit = useMutationState<void>()
const passwordSubmit = useMutationState<void>()
const totpEnroll = useMutationState<void>()
const totpVerify = useMutationState<void>()

const fullName = computed(() => {
  const profile = store.profile
  if (!profile) return ''
  return `${profile.firstName} ${profile.lastName}`.trim() || profile.username
})

const createdAt = computed(() => {
  if (!store.profile) return ''
  return new Date(store.profile.createdAt).toLocaleString()
})

const qrImage = computed(() => {
  const qrUri = store.totpEnrollment?.qrUri ?? ''
  return qrUri.startsWith('data:image/') ? qrUri : null
})

const profileSchema = updateProfileRequestSchema.extend({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
})

const passwordSchema = changePasswordRequestSchema
  .extend({
    confirmPassword: z.string().min(1, 'Confirm the new password'),
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(12, 'New password must be at least 12 characters'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const totpCodeSchema = totpVerifyRequestSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

onMounted(async () => {
  loadErrors.clear()
  try {
    await store.loadProfile()
  } catch (e) {
    loadErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not load account', e)
  }
})

watch(
  () => store.profile,
  (profile) => {
    if (!profile) return
    profileForm.firstName = profile.firstName
    profileForm.lastName = profile.lastName
  },
  { immediate: true },
)

function startProfileEdit(): void {
  if (!store.profile) return
  profileValidation.value = {}
  profileErrors.clear()
  profileForm.firstName = store.profile.firstName
  profileForm.lastName = store.profile.lastName
  editingProfile.value = true
}

function cancelProfileEdit(): void {
  editingProfile.value = false
  profileValidation.value = {}
  profileErrors.clear()
}

async function submitProfile(): Promise<void> {
  const parsed = profileSchema.safeParse(profileForm)
  profileValidation.value = parsed.success ? {} : validationErrors(parsed.error)
  if (!parsed.success) return

  profileErrors.clear()
  try {
    await profileSubmit.run(async () => {
      await store.updateProfile(parsed.data)
    })
    editingProfile.value = false
    toast.success('Profile updated')
  } catch (e) {
    profileErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not update profile', e)
  }
}

async function submitPassword(): Promise<void> {
  const parsed = passwordSchema.safeParse(passwordForm)
  passwordValidation.value = parsed.success ? {} : validationErrors(parsed.error)
  if (!parsed.success) return

  passwordErrors.clear()
  try {
    await passwordSubmit.run(async () => {
      await store.changePassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      })
    })
    passwordForm.confirmPassword = ''
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    toast.success('Password changed')
  } catch (e) {
    passwordErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not change password', e)
  }
}

async function startTotpEnrollment(): Promise<void> {
  totpErrors.clear()
  try {
    await totpEnroll.run(async () => {
      await store.enrollTotp()
    })
  } catch (e) {
    totpErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not start TOTP enrollment', e)
  }
}

async function submitTotp(): Promise<void> {
  const parsed = totpCodeSchema.safeParse({ code: verifyCode.value })
  totpValidation.value = parsed.success ? {} : validationErrors(parsed.error)
  if (!parsed.success) return

  totpErrors.clear()
  try {
    await totpVerify.run(async () => {
      await store.verifyTotp(parsed.data)
    })
    verifyCode.value = ''
    toast.success('TOTP enabled')
  } catch (e) {
    totpErrors.captureFromCatch(e)
    toast.errorFromCatch('Could not verify TOTP', e)
  }
}

function validationErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && result[field] === undefined) result[field] = issue.message
  }
  return result
}
</script>

<template>
  <div class="mx-auto max-w-4xl p-6" data-testid="account-view">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">Account</h1>
      <p v-if="store.profile" class="mt-1 text-sm text-[var(--color-text-muted)]">
        Signed in as {{ store.profile.username }}
      </p>
    </header>

    <FormErrors :error="loadErrors.general.value" />

    <div v-if="store.isLoading" class="text-sm text-[var(--color-text-muted)]">Loading…</div>

    <div v-else-if="store.profile" class="space-y-6">
      <section class="rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">Profile</h2>
            <p class="text-sm text-[var(--color-text-muted)]" data-testid="account-profile-name">{{ fullName }}</p>
          </div>
          <SubmitButton
            v-if="!editingProfile"
            type="button"
            variant="secondary"
            label="Edit"
            data-testid="account-profile-edit"
            @click="startProfileEdit"
          />
        </div>

        <form v-if="editingProfile" class="space-y-4" data-testid="account-profile-form" @submit.prevent="submitProfile">
          <FormErrors :error="profileErrors.general.value" />

          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              label="First name"
              required
              :error="profileValidation.firstName ?? profileErrors.fieldErrorFor('firstName')"
            >
              <template #default="{ id, invalid }">
                <input
                  :id="id"
                  v-model="profileForm.firstName"
                  type="text"
                  required
                  class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
                  :aria-invalid="invalid"
                  data-testid="account-first-name"
                />
              </template>
            </FormField>

            <FormField
              label="Last name"
              required
              :error="profileValidation.lastName ?? profileErrors.fieldErrorFor('lastName')"
            >
              <template #default="{ id, invalid }">
                <input
                  :id="id"
                  v-model="profileForm.lastName"
                  type="text"
                  required
                  class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
                  :aria-invalid="invalid"
                  data-testid="account-last-name"
                />
              </template>
            </FormField>
          </div>

          <div class="flex justify-end gap-2">
            <SubmitButton type="button" variant="secondary" label="Cancel" @click="cancelProfileEdit" />
            <SubmitButton label="Save profile" :status="profileSubmit.status.value" data-testid="account-profile-save" />
          </div>
        </form>

        <dl v-else class="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-[var(--color-text-muted)]">Email</dt>
            <dd data-testid="account-email">{{ store.profile.email }}</dd>
          </div>
          <div>
            <dt class="text-[var(--color-text-muted)]">Role</dt>
            <dd>{{ store.profile.role }}</dd>
          </div>
          <div>
            <dt class="text-[var(--color-text-muted)]">Created</dt>
            <dd>{{ createdAt }}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <h2 class="text-lg font-semibold">Security</h2>
        <form class="mt-4 space-y-4" data-testid="account-password-form" @submit.prevent="submitPassword">
          <FormErrors :error="passwordErrors.general.value" />

          <FormField
            label="Current password"
            required
            :error="passwordValidation.currentPassword ?? passwordErrors.fieldErrorFor('currentPassword')"
          >
            <template #default="{ id, invalid }">
              <input
                :id="id"
                v-model="passwordForm.currentPassword"
                type="password"
                autocomplete="current-password"
                class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
                :aria-invalid="invalid"
                data-testid="account-current-password"
              />
            </template>
          </FormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              label="New password"
              required
              :error="passwordValidation.newPassword ?? passwordErrors.fieldErrorFor('newPassword')"
            >
              <template #default="{ id, invalid }">
                <input
                  :id="id"
                  v-model="passwordForm.newPassword"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
                  :aria-invalid="invalid"
                  data-testid="account-new-password"
                />
              </template>
            </FormField>

            <FormField label="Confirm password" required :error="passwordValidation.confirmPassword">
              <template #default="{ id, invalid }">
                <input
                  :id="id"
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
                  :aria-invalid="invalid"
                  data-testid="account-confirm-password"
                />
              </template>
            </FormField>
          </div>

          <div class="flex justify-end">
            <SubmitButton
              label="Change password"
              :status="passwordSubmit.status.value"
              data-testid="account-password-submit"
            />
          </div>
        </form>
      </section>

      <section class="rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">Two-factor authentication</h2>
            <p class="mt-1 text-sm text-[var(--color-text-muted)]">
              Add a time-based one-time password to protect this account.
            </p>
          </div>
          <span
            v-if="store.profile.totpEnabled"
            class="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-400"
            data-testid="account-totp-enabled"
          >
            Enabled
          </span>
        </div>

        <div v-if="store.profile.totpEnabled" class="mt-4 text-sm text-[var(--color-text-muted)]">
          TOTP is enabled for this account.
        </div>

        <div v-else class="mt-4 space-y-4" data-testid="account-totp-flow">
          <FormErrors :error="totpErrors.general.value" />

          <SubmitButton
            v-if="!store.totpEnrollment"
            type="button"
            label="Enable TOTP"
            :status="totpEnroll.status.value"
            data-testid="account-totp-enroll"
            @click="startTotpEnrollment"
          />

          <div v-else class="space-y-4">
            <div v-if="qrImage" class="inline-block rounded bg-white p-3">
              <img :src="qrImage" alt="TOTP QR code" class="h-48 w-48" data-testid="account-totp-qr" />
            </div>
            <div v-else>
              <p class="mb-2 text-sm text-[var(--color-text-muted)]">Add this URI to your authenticator app.</p>
              <pre
                class="overflow-x-auto rounded border border-[var(--color-surface-border)] p-3 text-xs"
                data-testid="account-totp-uri"
              >{{ store.totpEnrollment.qrUri }}</pre>
            </div>

            <div>
              <p class="text-sm text-[var(--color-text-muted)]">Secret</p>
              <code class="select-all break-all text-sm" data-testid="account-totp-secret">
                {{ store.totpEnrollment.secret }}
              </code>
            </div>

            <form class="space-y-4" data-testid="account-totp-verify-form" @submit.prevent="submitTotp">
              <FormField
                label="Verification code"
                required
                :error="totpValidation.code ?? totpErrors.fieldErrorFor('code')"
              >
                <template #default="{ id, invalid }">
                  <input
                    :id="id"
                    v-model="verifyCode"
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                    class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 font-mono text-sm"
                    :aria-invalid="invalid"
                    data-testid="account-totp-code"
                  />
                </template>
              </FormField>

              <div class="flex justify-end">
                <SubmitButton label="Verify" :status="totpVerify.status.value" data-testid="account-totp-verify" />
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>

  </div>
</template>
