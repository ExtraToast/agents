import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router'

interface FeatureNavigationItem {
  icon: string
  id: string
  label: string
  order: number
  requiresAuth: boolean
  section: string
  to: RouteLocationRaw
}

interface FeatureRouteModule {
  feature: string
  navigation: FeatureNavigationItem[]
  routes: RouteRecordRaw[]
}

export default {
  feature: 'account',
  routes: [
    {
      path: '/account',
      name: 'account',
      component: () => import('./views/AccountView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navigation: [
    {
      id: 'account',
      label: 'Account',
      to: { name: 'account' },
      section: 'user',
      order: 90,
      icon: 'user',
      requiresAuth: true,
    },
  ],
} satisfies FeatureRouteModule
