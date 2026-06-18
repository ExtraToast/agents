import type { AdminUserResponse } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  deleteUser as deleteUserApi,
  getUser as getUserApi,
  listUsers as listUsersApi,
  updateRole as updateRoleApi,
  updateServicePermissions as updateServicePermissionsApi,
} from '../services/adminService'

export const useAdminStore = defineStore('admin', () => {
  const users = ref<AdminUserResponse[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedUser = ref<AdminUserResponse | null>(null)

  async function listUsers(): Promise<AdminUserResponse[]> {
    loading.value = true
    error.value = null
    try {
      users.value = await listUsersApi()
      return users.value
    } catch (e) {
      error.value = messageFromError(e, 'Failed to load users')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getUser(id: string): Promise<AdminUserResponse> {
    loading.value = true
    error.value = null
    try {
      const user = await getUserApi(id)
      selectedUser.value = user
      replaceUser(user)
      return user
    } catch (e) {
      error.value = messageFromError(e, 'Failed to load user')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRole(id: string, role: string): Promise<AdminUserResponse> {
    error.value = null
    try {
      const user = await updateRoleApi(id, role)
      replaceUser(user)
      return user
    } catch (e) {
      error.value = messageFromError(e, 'Failed to update role')
      throw e
    }
  }

  async function updateServicePermissions(id: string, services: string[]): Promise<AdminUserResponse> {
    error.value = null
    try {
      const user = await updateServicePermissionsApi(id, services)
      replaceUser(user)
      return user
    } catch (e) {
      error.value = messageFromError(e, 'Failed to update service permissions')
      throw e
    }
  }

  async function deleteUser(id: string): Promise<void> {
    error.value = null
    try {
      await deleteUserApi(id)
      users.value = users.value.filter((user) => user.id !== id)
      if (selectedUser.value?.id === id) selectedUser.value = null
    } catch (e) {
      error.value = messageFromError(e, 'Failed to delete user')
      throw e
    }
  }

  function replaceUser(user: AdminUserResponse): void {
    const index = users.value.findIndex((candidate) => candidate.id === user.id)
    if (index === -1) {
      users.value = [user, ...users.value]
    } else {
      users.value[index] = user
    }

    if (selectedUser.value?.id === user.id) selectedUser.value = user
  }

  return {
    users,
    loading,
    error,
    selectedUser,
    listUsers,
    getUser,
    updateRole,
    updateServicePermissions,
    deleteUser,
  }
})

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
