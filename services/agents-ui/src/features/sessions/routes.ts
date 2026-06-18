import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'sessions',
  routes: [
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('@/features/sessions/views/SessionsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navigation: [
    {
      id: 'sessions',
      label: 'Sessions',
      to: { name: 'sessions' },
      section: 'main',
      order: 10,
      icon: 'terminal',
      requiresAuth: true,
    },
  ],
} satisfies FeatureRouteModule
