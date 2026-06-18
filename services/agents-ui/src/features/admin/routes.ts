import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'admin',
  routes: [
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('./views/AdminUsersView.vue'),
      meta: { requiresAuth: true, adminCapability: 'admin' },
    },
  ],
  navigation: [
    {
      id: 'admin-users',
      label: 'Users',
      to: { name: 'admin-users' },
      section: 'admin',
      order: 10,
      icon: 'users',
      requiresAuth: true,
      adminCapability: 'admin',
    },
  ],
} satisfies FeatureRouteModule
