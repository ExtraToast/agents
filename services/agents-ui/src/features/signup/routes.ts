import type { FeatureRouteModule } from '@/router/types'

export default {
  feature: 'signup',
  routes: [
    {
      path: '/register',
      name: 'register',
      component: () => import('./views/RegisterView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/confirm-email',
      name: 'confirm-email',
      component: () => import('./views/ConfirmEmailView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('./views/ForgotPasswordView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('./views/ResetPasswordView.vue'),
      meta: { requiresAuth: false },
    },
  ],
  navigation: [],
} satisfies FeatureRouteModule
