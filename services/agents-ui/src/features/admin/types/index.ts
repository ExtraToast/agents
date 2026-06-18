import { z } from 'zod'

export const assignableRoles = ['ADMIN', 'USER', 'READONLY'] as const

export type AssignableRole = (typeof assignableRoles)[number]

export const adminUserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  emailConfirmed: z.boolean(),
  totpEnabled: z.boolean(),
  servicePermissions: z.array(z.string()),
  createdAt: z.string(),
})

export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>

export const updateRoleRequestSchema = z.object({
  role: z.string().min(1),
})

export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>

export const updateServicePermissionsRequestSchema = z.object({
  services: z.array(z.string().min(1)),
})

export type UpdateServicePermissionsRequest = z.infer<typeof updateServicePermissionsRequestSchema>
