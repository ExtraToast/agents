import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeNativeChrome } from '..'
import { webAppUrlOpener } from '../web/appUrlOpener'
import { webPlatformInfo } from '../web/platformInfo'
import { webSecureStorage } from '../web/secureStorage'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

vi.mock('@capacitor/splash-screen', () => {
  throw new Error('SplashScreen should not load on web')
})

vi.mock('@capacitor/status-bar', () => {
  throw new Error('StatusBar should not load on web')
})

function createLocalStorageStub(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

describe('web platform adapters', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips secure storage through localStorage', async () => {
    await webSecureStorage.setItem('session', 'abc123')

    await expect(webSecureStorage.getItem('session')).resolves.toBe('abc123')

    await webSecureStorage.removeItem('session')

    await expect(webSecureStorage.getItem('session')).resolves.toBeNull()
  })

  it('reports the web platform', () => {
    expect(webPlatformInfo).toEqual({
      isNative: false,
      platform: 'web',
    })
  })

  it('registers app-url listeners as a safe no-op', async () => {
    const listener = vi.fn()
    const registration = await webAppUrlOpener.onAppUrlOpen(listener)

    await registration.remove()

    expect(listener).not.toHaveBeenCalled()
  })

  it('does not load native chrome plugins on web', async () => {
    await expect(initializeNativeChrome()).resolves.toBeUndefined()
  })
})
