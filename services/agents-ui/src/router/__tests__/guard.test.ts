import type { RouteMeta } from 'vue-router'
import type { ShellAuthState } from '../guard'
import { describe, expect, it, vi } from 'vitest'
import { canAccessAdminCapability, createProtectedRouteGuard } from '../guard'

describe('protected route guard', () => {
  it('restores unknown auth state before allowing a protected route', async () => {
    const auth = authState({ authenticated: false, role: null })
    auth.fetchUser = vi.fn(async () => {
      auth.isAuthenticated.value = true
      auth.user.value = { role: 'USER' }
    })

    const guard = createProtectedRouteGuard(() => auth)

    await expect(guard(to({ requiresAuth: true }))).resolves.toBe(true)
    expect(auth.fetchUser).toHaveBeenCalledTimes(1)
  })

  it('allows protected routes after successful restoration', async () => {
    const auth = authState({ authenticated: false, role: null })
    auth.fetchUser = vi.fn(async () => {
      auth.isAuthenticated.value = true
      auth.user.value = { role: 'READONLY' }
    })

    const guard = createProtectedRouteGuard(() => auth)

    await expect(guard(to({ requiresAuth: true }))).resolves.toBe(true)
  })

  it('redirects failed restoration to login with the attempted destination', async () => {
    const auth = authState({ authenticated: false, role: null })
    auth.fetchUser = vi.fn(async () => {})

    const guard = createProtectedRouteGuard(() => auth)

    await expect(guard(to({ requiresAuth: true }, '/projects?filter=open'))).resolves.toEqual({
      name: 'login',
      query: { redirect: '/projects?filter=open' },
    })
  })

  it('does not redirect-loop while navigating to login', async () => {
    const guard = createProtectedRouteGuard(() => authState({ authenticated: false, role: null }))

    await expect(guard({
      fullPath: '/login',
      meta: { requiresAuth: true },
      name: 'login',
    })).resolves.toBe(true)
  })

  it('does not restore public routes', async () => {
    const auth = authState({ authenticated: false, role: null })
    auth.fetchUser = vi.fn(async () => {
      auth.isAuthenticated.value = true
    })

    const guard = createProtectedRouteGuard(() => auth)

    await expect(guard(to({}))).resolves.toBe(true)
    expect(auth.fetchUser).not.toHaveBeenCalled()
  })
})

describe('admin capability checks', () => {
  it('allows admins through admin routes', async () => {
    const guard = createProtectedRouteGuard(() => authState({ authenticated: true, role: 'ADMIN' }))

    await expect(guard(to({ requiresAuth: true, adminCapability: 'admin' }))).resolves.toBe(true)
  })

  it('denies non-admin users on admin routes', async () => {
    const guard = createProtectedRouteGuard(() => authState({ authenticated: true, role: 'USER' }))

    await expect(guard(to({ requiresAuth: true, adminCapability: 'admin' }))).resolves.toBe(false)
  })

  it('fails closed for unknown capabilities', () => {
    expect(canAccessAdminCapability('unknown', () => true)).toBe(false)
  })
})

function authState(options: { authenticated: boolean; role: string | null }): ShellAuthState {
  return {
    isAuthenticated: { value: options.authenticated },
    user: { value: options.role === null ? null : { role: options.role } },
  }
}

function to(meta: RouteMeta, fullPath = '/sessions') {
  return { fullPath, meta }
}
