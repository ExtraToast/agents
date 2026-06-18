import type { AdminUserResponse } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/lib/authApi'
import {
  deleteUser,
  getUser,
  listUsers,
  updateRole,
  updateServicePermissions,
} from '../services/adminService'

vi.mock('@/lib/authApi', () => ({
  AuthApiError: class AuthApiError extends Error {},
  authApi: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}))

const mockedAuthApi = {
  del: vi.mocked(authApi.del),
  get: vi.mocked(authApi.get),
  patch: vi.mocked(authApi.patch),
  put: vi.mocked(authApi.put),
}

function user(overrides: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'USER',
    emailConfirmed: true,
    totpEnabled: false,
    servicePermissions: ['agents'],
    createdAt: '2026-06-18T10:00:00Z',
    ...overrides,
  }
}

describe('admin service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists users from the admin endpoint', async () => {
    mockedAuthApi.get.mockResolvedValue([user()])

    await expect(listUsers()).resolves.toEqual([user()])

    expect(mockedAuthApi.get).toHaveBeenCalledWith('/admin/users')
  })

  it('gets one user with an encoded id', async () => {
    mockedAuthApi.get.mockResolvedValue(user({ id: 'user/one' }))

    await expect(getUser('user/one')).resolves.toEqual(user({ id: 'user/one' }))

    expect(mockedAuthApi.get).toHaveBeenCalledWith('/admin/users/user%2Fone')
  })

  it('updates role with the expected request body', async () => {
    mockedAuthApi.patch.mockResolvedValue(user({ role: 'ADMIN' }))

    await expect(updateRole('user/one', 'ADMIN')).resolves.toMatchObject({ role: 'ADMIN' })

    expect(mockedAuthApi.patch).toHaveBeenCalledWith('/admin/users/user%2Fone/role', { role: 'ADMIN' })
  })

  it('updates service permissions with normalized services', async () => {
    mockedAuthApi.put.mockResolvedValue(user({ servicePermissions: ['agents', 'billing'] }))

    await expect(updateServicePermissions('user/one', [' billing ', 'agents', 'agents'])).resolves.toMatchObject({
      servicePermissions: ['agents', 'billing'],
    })

    expect(mockedAuthApi.put).toHaveBeenCalledWith('/admin/users/user%2Fone/services', {
      services: ['agents', 'billing'],
    })
  })

  it('deletes users with an encoded id', async () => {
    mockedAuthApi.del.mockResolvedValue(undefined)

    await deleteUser('user/one')

    expect(mockedAuthApi.del).toHaveBeenCalledWith('/admin/users/user%2Fone')
  })
})
