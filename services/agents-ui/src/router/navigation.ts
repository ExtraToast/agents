import type { NavigationItem } from './types'
import { routeManifest } from './discovery'
import { canAccessAdminCapability, requiresAuthentication } from './guard'

export interface NavigationAuthState {
  isAuthenticated: boolean
  hasCapability: (capability: string) => boolean
}

export function buildNavigation(items: NavigationItem[]): NavigationItem[] {
  return [...items].sort(compareNavigationItems)
}

export const navigationItems = buildNavigation(routeManifest.navigation)

export function filterNavigation(items: NavigationItem[], auth: NavigationAuthState): NavigationItem[] {
  return items.filter((item) => {
    if (requiresAuthentication(item) && !auth.isAuthenticated) {
      return false
    }

    return canAccessAdminCapability(item.adminCapability, auth.hasCapability)
  })
}

function compareNavigationItems(a: NavigationItem, b: NavigationItem): number {
  return a.section.localeCompare(b.section)
    || (a.order ?? 0) - (b.order ?? 0)
    || a.id.localeCompare(b.id)
}
