import type { SecureStorage } from '../types'

export const webSecureStorage: SecureStorage = {
  async getItem(key) {
    return window.localStorage.getItem(key)
  },
  async setItem(key, value) {
    window.localStorage.setItem(key, value)
  },
  async removeItem(key) {
    window.localStorage.removeItem(key)
  },
}
