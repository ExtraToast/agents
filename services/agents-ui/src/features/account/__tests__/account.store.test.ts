import type { ProfileResponse } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changePassword,
  enrollTotp,
  getProfile,
  updateProfile,
  verifyTotp,
} from '../services/accountService'
import { useAccountStore } from '../stores/account'

vi.mock('../services/accountService', () => ({
  changePassword: vi.fn(),
  enrollTotp: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  verifyTotp: vi.fn(),
}))

const mocked = {
  changePassword: vi.mocked(changePassword),
  enrollTotp: vi.mocked(enrollTotp),
  getProfile: vi.mocked(getProfile),
  updateProfile: vi.mocked(updateProfile),
  verifyTotp: vi.mocked(verifyTotp),
}

function profile(over: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'USER',
    totpEnabled: false,
    createdAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

describe('account store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the profile', async () => {
    mocked.getProfile.mockResolvedValue(profile())
    const store = useAccountStore()

    await store.loadProfile()

    expect(store.profile?.username).toBe('ada')
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('captures load errors and rethrows', async () => {
    mocked.getProfile.mockRejectedValue(new Error('no session'))
    const store = useAccountStore()

    await expect(store.loadProfile()).rejects.toThrow('no session')

    expect(store.error).toBe('no session')
    expect(store.isLoading).toBe(false)
  })

  it('updates profile state after profile edits', async () => {
    mocked.updateProfile.mockResolvedValue(profile({ firstName: 'Grace' }))
    const store = useAccountStore()

    await store.updateProfile({ firstName: 'Grace', lastName: 'Hopper' })

    expect(store.profile?.firstName).toBe('Grace')
  })

  it('tracks totp enrollment and enables totp after verification', async () => {
    mocked.enrollTotp.mockResolvedValue({ secret: 'SECRET', qrUri: 'otpauth://totp/demo' })
    mocked.verifyTotp.mockResolvedValue()
    const store = useAccountStore()
    store.profile = profile()

    await store.enrollTotp()
    expect(store.totpEnrollment?.secret).toBe('SECRET')

    await store.verifyTotp({ code: '123456' })
    expect(store.totpEnrollment).toBeNull()
    expect(store.profile?.totpEnabled).toBe(true)
  })

  it('wraps password errors', async () => {
    mocked.changePassword.mockRejectedValue(new Error('wrong password'))
    const store = useAccountStore()

    await expect(
      store.changePassword({ currentPassword: 'old-password', newPassword: 'new-password-123' }),
    ).rejects.toThrow('wrong password')

    expect(store.error).toBe('wrong password')
  })
})
