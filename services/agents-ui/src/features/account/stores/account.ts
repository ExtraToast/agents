import type {
  ChangePasswordRequest,
  ProfileResponse,
  TotpEnrollResponse,
  TotpVerifyRequest,
  UpdateProfileRequest,
} from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  changePassword as changePasswordApi,
  enrollTotp as enrollTotpApi,
  getProfile,
  updateProfile as updateProfileApi,
  verifyTotp as verifyTotpApi,
} from '../services/accountService'

export const useAccountStore = defineStore('account', () => {
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  const profile = ref<ProfileResponse | null>(null)
  const totpEnrollment = ref<TotpEnrollResponse | null>(null)

  async function loadProfile(): Promise<ProfileResponse> {
    isLoading.value = true
    error.value = null
    try {
      profile.value = await getProfile()
      return profile.value
    } catch (e) {
      error.value = errorMessage(e, 'Failed to load account')
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfile(body: UpdateProfileRequest): Promise<ProfileResponse> {
    error.value = null
    try {
      profile.value = await updateProfileApi(body)
      return profile.value
    } catch (e) {
      error.value = errorMessage(e, 'Failed to update profile')
      throw e
    }
  }

  async function changePassword(body: ChangePasswordRequest): Promise<void> {
    error.value = null
    try {
      await changePasswordApi(body)
    } catch (e) {
      error.value = errorMessage(e, 'Failed to change password')
      throw e
    }
  }

  async function enrollTotp(): Promise<TotpEnrollResponse> {
    error.value = null
    try {
      totpEnrollment.value = await enrollTotpApi()
      return totpEnrollment.value
    } catch (e) {
      error.value = errorMessage(e, 'Failed to start TOTP enrollment')
      throw e
    }
  }

  async function verifyTotp(body: TotpVerifyRequest): Promise<void> {
    error.value = null
    try {
      await verifyTotpApi(body)
      totpEnrollment.value = null
      if (profile.value) profile.value = { ...profile.value, totpEnabled: true }
    } catch (e) {
      error.value = errorMessage(e, 'Failed to verify TOTP')
      throw e
    }
  }

  return {
    error,
    isLoading,
    profile,
    totpEnrollment,
    changePassword,
    enrollTotp,
    loadProfile,
    updateProfile,
    verifyTotp,
  }
})

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}
