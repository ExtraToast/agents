import type { RouteLocationRaw, RouteMeta } from 'vue-router'
import type { AdminCapability, AuthRole, CapabilityQuery } from './types'
import { createCapabilityQuery, isAdminCapability } from './types'

interface ReadableRef<T> {
  value: T;
}

export interface ShellAuthUser {
  role?: AuthRole | string;
}

export interface ShellAuthState {
  isAuthenticated: ReadableRef<boolean>;
  user: ReadableRef<ShellAuthUser | null | undefined>;
  fetchUser?: () => Promise<unknown>;
}

interface ProtectedRouteGuardTarget {
  fullPath: string;
  meta: RouteMeta;
  name?: string | symbol | null | undefined;
}

export type ProtectedRouteGuard = (to: ProtectedRouteGuardTarget) => Promise<boolean | RouteLocationRaw>

export function createProtectedRouteGuard(getAuth: () => ShellAuthState): ProtectedRouteGuard {
  return async (to) => {
    const auth = getAuth()

    if (!requiresAuthentication(to.meta)) {
      return true
    }

    if (isUnknownAuthState(auth) && auth.fetchUser) {
      try {
        await auth.fetchUser()
      } catch {
        // Keep protected routes closed when session restoration cannot be confirmed.
      }
    }

    if (!auth.isAuthenticated.value) {
      if (to.name === 'login') return true

      return {
        name: 'login',
        query: { redirect: to.fullPath || '/' },
      }
    }

    if (!canAccessAdminCapability(to.meta.adminCapability, createCapabilityQuery(auth.user.value?.role))) {
      return false
    }

    return true
  }
}

export function requiresAuthentication(target: Pick<RouteMeta, 'requiresAuth' | 'adminCapability'>): boolean {
  return target.requiresAuth === true || target.adminCapability !== undefined
}

export function canAccessAdminCapability(
  capability: AdminCapability | string | undefined,
  hasCapability: CapabilityQuery,
): boolean {
  if (capability === undefined) return true
  if (!isAdminCapability(capability)) return false

  return hasCapability(capability)
}

function isUnknownAuthState(auth: ShellAuthState): boolean {
  return !auth.isAuthenticated.value && auth.user.value == null
}
