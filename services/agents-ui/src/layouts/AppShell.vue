<script setup lang="ts">
import type { AppShellNavItem } from '@/lib/vueWebCommons'
import type { NavigationItem } from '@/router/types'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import * as commons from '@/lib/vueWebCommons'
import { routeManifest } from '@/router/discovery'
import { filterNavigation, navigationItems } from '@/router/navigation'

const { agentsThemeOptions, AppShell: CommonsAppShell } = commons
const router = useRouter()
const hasAuthApi = typeof commons.useAuth === 'function'
const auth = hasAuthApi
  ? commons.useAuth()
  : {
      isAuthenticated: { value: false },
      user: { value: null },
      logout: async () => undefined,
    }

const sessionChildren: AppShellNavItem[] = [
  { label: 'Workspace', to: '/sessions?tab=workspace', testid: 'nav-sessions-workspace', icon: 'window' },
  { label: 'Scratch', to: '/sessions?tab=scratch', testid: 'nav-sessions-scratch', icon: 'terminal' },
  { label: 'Chat', to: '/sessions?tab=chat', testid: 'nav-sessions-chat', icon: 'chat' },
]

const routePathsByName = new Map(
  flattenRoutes(routeManifest.routes)
    .filter((route) => route.name !== undefined)
    .map((route) => [String(route.name), route.path]),
)

const navItems = computed<AppShellNavItem[]>(() =>
  filterNavigation(navigationItems, {
    isAuthenticated: auth.isAuthenticated.value,
    hasCapability: (capability) => capability === 'admin' && auth.user.value?.role === 'ADMIN',
  }).map(toAppShellNavItem),
)

async function onLogout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}

function toAppShellNavItem(item: NavigationItem): AppShellNavItem {
  const navItem: AppShellNavItem = {
    label: item.label,
    to: navigationPath(item),
    testid: `nav-${item.id}`,
  }

  if (item.icon !== undefined) navItem.icon = item.icon
  if (item.id === 'sessions') navItem.children = sessionChildren

  return navItem
}

function navigationPath(item: NavigationItem): string {
  if (typeof item.to === 'string') return item.to
  if ('path' in item.to && typeof item.to.path === 'string') return item.to.path
  if ('name' in item.to && item.to.name !== undefined) {
    return routePathsByName.get(String(item.to.name)) ?? `/${String(item.to.name)}`
  }

  return '/'
}

function flattenRoutes(routes: typeof routeManifest.routes): typeof routeManifest.routes {
  return routes.flatMap((route) => [
    route,
    ...flattenRoutes(route.children ?? []),
  ])
}

const legacyNavItems: AppShellNavItem[] = [
  {
    label: 'Sessions',
    to: '/sessions',
    testid: 'nav-sessions',
    icon: 'terminal',
    children: [
      { label: 'Workspace', to: '/sessions?tab=workspace', testid: 'nav-sessions-workspace', icon: 'window' },
      { label: 'Scratch', to: '/sessions?tab=scratch', testid: 'nav-sessions-scratch', icon: 'terminal' },
      { label: 'Chat', to: '/sessions?tab=chat', testid: 'nav-sessions-chat', icon: 'chat' },
    ],
  },
  { label: 'Projects', to: '/projects', testid: 'nav-projects', icon: 'folder' },
  { label: 'Repositories', to: '/repositories', testid: 'nav-repositories', icon: 'git' },
]
</script>

<template>
  <CommonsAppShell
    brand-main="agents"
    layout="rail"
    new-action-label="New session"
    new-action-to="/sessions?tab=workspace&new=1"
    :nav-items="hasAuthApi ? navItems : legacyNavItems"
    :theme-options="agentsThemeOptions"
    @logout="onLogout"
  >
    <div v-if="auth.isAuthenticated.value" class="fixed right-4 top-4 z-50">
      <button
        type="button"
        class="rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] px-3 py-2 text-sm"
        data-testid="nav-logout"
        @click="onLogout"
      >
        Logout
      </button>
    </div>
    <slot />
  </CommonsAppShell>
</template>
