import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router'

export const adminCapabilities = ['admin'] as const

export type AdminCapability = (typeof adminCapabilities)[number]
export type AuthRole = 'ADMIN' | 'USER' | 'READONLY'
export type CapabilityQuery = (capability: AdminCapability) => boolean

export interface NavigationItem {
  id: string
  label: string
  to: RouteLocationRaw | string
  section: string
  order?: number
  icon?: string
  requiresAuth?: boolean
  adminCapability?: AdminCapability
}

export interface FeatureRouteModule {
  feature: string
  routes: RouteRecordRaw[]
  navigation?: NavigationItem[]
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    adminCapability?: AdminCapability
  }
}

export function isAdminCapability(capability: string): capability is AdminCapability {
  return (adminCapabilities as readonly string[]).includes(capability)
}

export function createCapabilityQuery(role: AuthRole | string | undefined): CapabilityQuery {
  return (capability) => role === 'ADMIN' && isAdminCapability(capability)
}
