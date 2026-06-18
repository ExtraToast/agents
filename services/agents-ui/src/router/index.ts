import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/lib/vueWebCommons'
import { assertNoDuplicateSiblingPaths, routeManifest } from './discovery'
import { createProtectedRouteGuard } from './guard'

const shellRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/sessions',
  },
]

const routes: RouteRecordRaw[] = [
  ...shellRoutes,
  ...routeManifest.routes,
]

assertNoDuplicateSiblingPaths(routes, 'router')

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

const protectedRouteGuard = createProtectedRouteGuard(() => useAuth())
router.beforeEach((to) => protectedRouteGuard(to))
