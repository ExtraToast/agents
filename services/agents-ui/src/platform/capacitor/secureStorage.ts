import type { SecureStorage } from '../types'
import { Preferences } from '@capacitor/preferences'

export const capacitorSecureStorage: SecureStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key, value) {
    await Preferences.set({ key, value })
  },
  async removeItem(key) {
    await Preferences.remove({ key })
  },
}
