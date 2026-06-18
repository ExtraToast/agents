import type { NavigationItem } from '../types'
import { describe, expect, it } from 'vitest'
import { buildNavigation, filterNavigation } from '../navigation'

describe('router navigation assembly', () => {
  const items: NavigationItem[] = [
    { id: 'zeta', label: 'Zeta', to: '/zeta', section: 'tools', order: 10 },
    { id: 'beta', label: 'Beta', to: '/beta', section: 'main', order: 20, requiresAuth: true },
    {
      id: 'admin',
      label: 'Admin',
      to: '/admin',
      section: 'main',
      order: 10,
      requiresAuth: true,
      adminCapability: 'admin',
    },
    { id: 'alpha', label: 'Alpha', to: '/alpha', section: 'main', order: 10, requiresAuth: true },
    { id: 'public', label: 'Public', to: '/public', section: 'main', order: 0 },
  ]

  it('sorts by section, order, and stable id', () => {
    expect(buildNavigation(items).map((item) => item.id)).toEqual(['public', 'admin', 'alpha', 'beta', 'zeta'])
  })

  it('filters anonymous navigation', () => {
    const visible = filterNavigation(buildNavigation(items), {
      isAuthenticated: false,
      hasCapability: () => false,
    })

    expect(visible.map((item) => item.id)).toEqual(['public', 'zeta'])
  })

  it('filters authenticated non-admin navigation', () => {
    const visible = filterNavigation(buildNavigation(items), {
      isAuthenticated: true,
      hasCapability: () => false,
    })

    expect(visible.map((item) => item.id)).toEqual(['public', 'alpha', 'beta', 'zeta'])
  })

  it('includes admin navigation for admins', () => {
    const visible = filterNavigation(buildNavigation(items), {
      isAuthenticated: true,
      hasCapability: () => true,
    })

    expect(visible.map((item) => item.id)).toEqual(['public', 'admin', 'alpha', 'beta', 'zeta'])
  })
})
