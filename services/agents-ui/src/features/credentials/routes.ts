import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'credentials',
  routes: [
    {
      path: '/credentials',
      name: 'credentials',
      component: () => import('@/features/credentials/views/CredentialsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navigation: [
    {
      id: 'credentials',
      label: 'Credentials',
      to: { name: 'credentials' },
      section: 'main',
      order: 40,
      icon: 'user',
      requiresAuth: true,
    },
  ],
} satisfies FeatureRouteModule
