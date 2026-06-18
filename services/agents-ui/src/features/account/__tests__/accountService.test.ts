import type { ProfileResponse } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changePassword, enrollTotp, getProfile, updateProfile, verifyTotp } from '../services/accountService'

const authApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/authApi', () => ({
  authApi: authApiMock,
}))

const mocked = {
  get: authApiMock.get,
  patch: authApiMock.patch,
  post: authApiMock.post,
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

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gets the current profile', async () => {
    mocked.get.mockResolvedValue(profile())

    await expect(getProfile()).resolves.toMatchObject({ username: 'ada' })

    expect(mocked.get).toHaveBeenCalledWith('/users/me')
  })

  it('updates the current profile', async () => {
    mocked.patch.mockResolvedValue(profile({ firstName: 'Grace' }))

    await expect(updateProfile({ firstName: 'Grace', lastName: 'Hopper' })).resolves.toMatchObject({
      firstName: 'Grace',
    })

    expect(mocked.patch).toHaveBeenCalledWith('/users/me', { firstName: 'Grace', lastName: 'Hopper' })
  })

  it('changes the password', async () => {
    mocked.post.mockResolvedValue(undefined)

    await changePassword({ currentPassword: 'old-password', newPassword: 'new-password-123' })

    expect(mocked.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    })
  })

  it('enrolls and verifies totp', async () => {
    mocked.post
      .mockResolvedValueOnce({ secret: 'SECRET', qrUri: 'otpauth://totp/demo' })
      .mockResolvedValueOnce(undefined)

    await expect(enrollTotp()).resolves.toEqual({ secret: 'SECRET', qrUri: 'otpauth://totp/demo' })
    await verifyTotp({ code: '123456' })

    expect(mocked.post).toHaveBeenNthCalledWith(1, '/totp/enroll')
    expect(mocked.post).toHaveBeenNthCalledWith(2, '/totp/verify', { code: '123456' })
  })
})
