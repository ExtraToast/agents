import type { RouteMeta } from 'vue-router'
import type { AdminCapability, AuthRole, CapabilityQuery } from './types'
import { createCapabilityQuery, isAdminCapability } from './types'

interface ReadableRef<T> {
  value: T
}

export interface ShellAuthUser {
  role?: AuthRole | string
}

export interface ShellAuthState {
  isAuthenticated: ReadableRef<boolean>
  user: ReadableRef<ShellAuthUser | null | undefined>
  fetchUser?: () => Promise<unknown>
}

interface ProtectedRouteGuardTarget {
  fullPath: string
  meta: RouteMeta
  name?: string | symbol | null | undefined
}

export interface ProtectedRouteGuardOptions {
  // Origin of the auth-ui sign-in surface (auth.<domain>). Login happens there,
  // same-origin, and the session cookie is shared across the parent domain — the
  // proven model used by the other apps. Defaults to the runtime auth origin.
  authOrigin?: string
  currentHref?: () => string
  redirect?: (url: string) => void
}

export type ProtectedRouteGuard = (to: ProtectedRouteGuardTarget) => Promise<boolean>

function resolveAuthOrigin(): string {
  const env = import.meta.env
  return (env.VITE_AUTH_ORIGIN ?? env.VITE_AUTH_URL ?? 'http://localhost:5174').replace(/\/+$/u, '')
}

export function createProtectedRouteGuard(
  getAuth: () => ShellAuthState,
  options: ProtectedRouteGuardOptions = {},
): ProtectedRouteGuard {
  const authOrigin = options.authOrigin ?? resolveAuthOrigin()
  const currentHref = options.currentHref ?? (() => (typeof window === 'undefined' ? '/' : window.location.href))
  const redirect = options.redirect ?? ((url: string) => {
    if (typeof window !== 'undefined') window.location.href = url
  })

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
      redirect(`${authOrigin}/login?redirect=${encodeURIComponent(currentHref())}`)
      return false
    }

    if (!canAccessAdminCapability(to.meta.adminCapability, createCapabilityQuery(auth.user.value?.role))) {
      return false
    }

    return true
  }
}

export function buildAuthLogoutUrl(): string {
  return `${resolveAuthOrigin()}/api/v1/auth/logout`
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
