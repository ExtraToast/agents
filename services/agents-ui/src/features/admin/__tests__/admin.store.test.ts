import type { AdminUserResponse } from '../types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteUser,
  getUser,
  listUsers,
  updateRole,
  updateServicePermissions,
} from '../services/adminService'
import { useAdminStore } from '../stores/admin'

vi.mock('../services/adminService', () => ({
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  listUsers: vi.fn(),
  updateRole: vi.fn(),
  updateServicePermissions: vi.fn(),
}))

const mocked = {
  deleteUser: vi.mocked(deleteUser),
  getUser: vi.mocked(getUser),
  listUsers: vi.mocked(listUsers),
  updateRole: vi.mocked(updateRole),
  updateServicePermissions: vi.mocked(updateServicePermissions),
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

describe('admin store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('listUsers populates state', async () => {
    mocked.listUsers.mockResolvedValue([user()])

    const store = useAdminStore()
    await store.listUsers()

    expect(store.users).toEqual([user()])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('listUsers records and rethrows errors', async () => {
    mocked.listUsers.mockRejectedValue(new Error('auth failed'))

    const store = useAdminStore()
    await expect(store.listUsers()).rejects.toThrow('auth failed')

    expect(store.error).toBe('auth failed')
    expect(store.loading).toBe(false)
  })

  it('getUser stores selected user and updates the cached list', async () => {
    const updated = user({ firstName: 'Augusta' })
    mocked.getUser.mockResolvedValue(updated)

    const store = useAdminStore()
    store.users = [user()]
    await store.getUser('user-1')

    expect(store.selectedUser).toEqual(updated)
    expect(store.users[0]).toEqual(updated)
  })

  it('updateRole replaces the cached row', async () => {
    mocked.updateRole.mockResolvedValue(user({ role: 'ADMIN' }))

    const store = useAdminStore()
    store.users = [user()]
    await store.updateRole('user-1', 'ADMIN')

    expect(store.users[0]!.role).toBe('ADMIN')
  })

  it('updateServicePermissions replaces the cached row', async () => {
    mocked.updateServicePermissions.mockResolvedValue(user({ servicePermissions: ['agents', 'billing'] }))

    const store = useAdminStore()
    store.users = [user()]
    await store.updateServicePermissions('user-1', ['agents', 'billing'])

    expect(store.users[0]!.servicePermissions).toEqual(['agents', 'billing'])
  })

  it('deleteUser removes cached rows and selected user', async () => {
    mocked.deleteUser.mockResolvedValue()

    const store = useAdminStore()
    const first = user()
    store.users = [first, user({ id: 'user-2' })]
    store.selectedUser = first
    await store.deleteUser('user-1')

    expect(store.users.map((candidate) => candidate.id)).toEqual(['user-2'])
    expect(store.selectedUser).toBeNull()
  })
})
