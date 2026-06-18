import type { AdminUserResponse } from '../types'
import { authApi } from '@/lib/authApi'
import {
  adminUserResponseSchema,
  updateRoleRequestSchema,
  updateServicePermissionsRequestSchema,
} from '../types'

const adminUsersSchema = adminUserResponseSchema.array()

function userPath(id: string): string {
  return `/admin/users/${encodeURIComponent(id)}`
}

export async function listUsers(): Promise<AdminUserResponse[]> {
  return adminUsersSchema.parse(await authApi.get('/admin/users'))
}

export async function getUser(id: string): Promise<AdminUserResponse> {
  return adminUserResponseSchema.parse(await authApi.get(userPath(id)))
}

export async function updateRole(id: string, role: string): Promise<AdminUserResponse> {
  const body = updateRoleRequestSchema.parse({ role })
  return adminUserResponseSchema.parse(await authApi.patch(`${userPath(id)}/role`, body))
}

export async function updateServicePermissions(id: string, services: string[]): Promise<AdminUserResponse> {
  const body = updateServicePermissionsRequestSchema.parse({ services: normalizeServices(services) })
  return adminUserResponseSchema.parse(await authApi.put(`${userPath(id)}/services`, body))
}

export async function deleteUser(id: string): Promise<void> {
  await authApi.del(userPath(id))
}

function normalizeServices(services: string[]): string[] {
  return Array.from(new Set(services.map((service) => service.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}
