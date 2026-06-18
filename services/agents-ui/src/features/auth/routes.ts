import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'auth',
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
  ],
  navigation: [],
} satisfies FeatureRouteModule
