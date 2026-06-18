import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'workspaces',
  routes: [
    {
      // Reached from the Sessions workspace and scratch flows; the
      // view remains owned by the workspaces feature.
      path: '/sessions/workspace/:id',
      name: 'workspace-detail',
      component: () => import('@/features/workspaces/views/WorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
  ],
} satisfies FeatureRouteModule
