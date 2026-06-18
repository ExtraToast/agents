import { Preferences } from '@capacitor/preferences'
import type { SecureStorage } from '../types'

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
