import type { AuthPlatform, SecureStorage } from './types'

const REFRESH_TOKEN_KEY = 'agents.nativeAuth.refreshToken'

export interface RefreshTokenRecord {
  refreshToken: string
}

export interface RefreshTokenStore {
  read: () => Promise<RefreshTokenRecord | null>
  replace: (record: RefreshTokenRecord) => Promise<void>
  clear: () => Promise<void>
}

export function createRefreshTokenStore(platform: Pick<AuthPlatform, 'secureStorage'>): RefreshTokenStore {
  return createRefreshTokenStoreFromStorage(platform.secureStorage)
}

export function createRefreshTokenStoreFromStorage(secureStorage: SecureStorage): RefreshTokenStore {
  return {
    async read(): Promise<RefreshTokenRecord | null> {
      const refreshToken = await secureStorage.get(REFRESH_TOKEN_KEY)
      return refreshToken === null ? null : { refreshToken }
    },
    async replace(record: RefreshTokenRecord): Promise<void> {
      await secureStorage.set(REFRESH_TOKEN_KEY, record.refreshToken)
    },
    async clear(): Promise<void> {
      await secureStorage.remove(REFRESH_TOKEN_KEY)
    },
  }
}

export const refreshTokenStorageNote = [
  'Refresh tokens are stored only through platform SecureStorage.',
  'The current platform may be backed by Capacitor Preferences.',
  'A Keychain/Keystore plugin can replace it behind the same interface.',
  'Access tokens remain in memory only.',
].join(' ')
