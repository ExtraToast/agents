import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'repositories',
  routes: [
    {
      path: '/repositories',
      name: 'repositories',
      component: () => import('@/features/repositories/views/RepositoriesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/repositories/:id',
      name: 'repository',
      component: () => import('@/features/repositories/views/RepositoryView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navigation: [
    {
      id: 'repositories',
      label: 'Repositories',
      to: { name: 'repositories' },
      section: 'main',
      order: 30,
      icon: 'git',
      requiresAuth: true,
    },
  ],
} satisfies FeatureRouteModule
