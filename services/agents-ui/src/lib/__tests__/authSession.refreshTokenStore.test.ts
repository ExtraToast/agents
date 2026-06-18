import type { SecureStorage } from '../authSession'
import { describe, expect, it, vi } from 'vitest'
import { createRefreshTokenStoreFromStorage } from '../authSession'

describe('authSession refresh token store', () => {
  it('reads, replaces, and clears refresh tokens through SecureStorage only', async () => {
    const values = new Map<string, string>()
    const storage: SecureStorage = {
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => {
        values.set(key, value)
      }),
      remove: vi.fn(async (key) => {
        values.delete(key)
      }),
    }
    const store = createRefreshTokenStoreFromStorage(storage)

    await expect(store.read()).resolves.toBeNull()
    await store.replace({ refreshToken: 'refresh-token-1' })
    await expect(store.read()).resolves.toEqual({ refreshToken: 'refresh-token-1' })
    await store.clear()
    await expect(store.read()).resolves.toBeNull()

    expect(storage.set).toHaveBeenCalledWith('agents.nativeAuth.refreshToken', 'refresh-token-1')
    expect(storage.remove).toHaveBeenCalledWith('agents.nativeAuth.refreshToken')
  })
})
