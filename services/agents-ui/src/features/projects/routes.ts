import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'projects',
  routes: [
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/features/projects/views/ProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:id',
      name: 'project',
      component: () => import('@/features/projects/views/ProjectView.vue'),
      meta: { requiresAuth: true },
    },
  ],
  navigation: [
    {
      id: 'projects',
      label: 'Projects',
      to: { name: 'projects' },
      section: 'main',
      order: 20,
      icon: 'folder',
      requiresAuth: true,
    },
  ],
} satisfies FeatureRouteModule
