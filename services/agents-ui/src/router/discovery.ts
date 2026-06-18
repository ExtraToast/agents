import type { RouteRecordRaw } from 'vue-router'
import type { FeatureRouteModule, NavigationItem } from './types'
import { isAdminCapability } from './types'

interface RouteModuleExport {
  default?: unknown
}

export interface FeatureRouteManifest {
  modules: FeatureRouteModule[]
  routes: RouteRecordRaw[]
  navigation: NavigationItem[]
}

const routeModuleExports = import.meta.glob('../features/*/routes.ts', { eager: true })

export const routeManifest = assembleRouteManifest(routeModuleExports)

export function assembleRouteManifest(modules: Record<string, unknown>): FeatureRouteManifest {
  const featureModules = Object.entries(modules)
    .map(([path, moduleExport]) => validateFeatureRouteModule(path, moduleExport))
    .sort((a, b) => a.feature.localeCompare(b.feature))

  const routes = featureModules.flatMap((module) => module.routes)
  const navigation = featureModules.flatMap((module) => module.navigation ?? [])

  assertNoDuplicateRouteNames(routes)
  assertNoDuplicateSiblingPaths(routes, 'feature route manifest')
  assertNoDuplicateNavigationIds(navigation)

  return {
    modules: featureModules,
    routes,
    navigation,
  }
}

export function assertNoDuplicateSiblingPaths(routes: RouteRecordRaw[], context: string): void {
  const paths = new Set<string>()

  for (const route of routes) {
    if (paths.has(route.path)) {
      throw new Error(`Route shell ${context} contains duplicate sibling path "${route.path}"`)
    }

    paths.add(route.path)

    if (route.children) {
      assertNoDuplicateSiblingPaths(route.children, `${context} > ${route.path}`)
    }
  }
}

function validateFeatureRouteModule(path: string, moduleExport: unknown): FeatureRouteModule {
  const candidate = (moduleExport as RouteModuleExport | null)?.default // eslint-disable-line ts/consistent-type-assertions

  if (!isFeatureRouteModuleRecord(candidate)) {
    throw new Error(`Invalid route module ${path}: default export must be a feature route module`)
  }

  if (candidate.feature.trim().length === 0) {
    throw new Error(`Invalid route module ${path}: feature must be non-empty`)
  }

  if (!Array.isArray(candidate.routes)) {
    throw new TypeError(`Invalid route module ${path}: routes must be an array`)
  }

  if (candidate.routes.length === 0) {
    throw new Error(`Invalid route module ${path}: routes must not be empty`)
  }

  candidate.routes.forEach((route, index) => validateRouteRecord(path, route, `routes[${index}]`))

  if (candidate.navigation !== undefined) {
    if (!Array.isArray(candidate.navigation)) {
      throw new TypeError(`Invalid route module ${path}: navigation must be an array when provided`)
    }

    candidate.navigation.forEach((item, index) => validateNavigationItem(path, item, `navigation[${index}]`))
  }

  const featureRouteModule: FeatureRouteModule = {
    feature: candidate.feature,
    routes: candidate.routes,
  }

  if (candidate.navigation !== undefined) {
    featureRouteModule.navigation = candidate.navigation
  }

  return featureRouteModule
}

function validateRouteRecord(path: string, route: RouteRecordRaw, routePath: string): void {
  validateRouteMeta(path, route, routePath)

  if (route.children) {
    route.children.forEach((child, index) => validateRouteRecord(path, child, `${routePath}.children[${index}]`))
    assertNoDuplicateSiblingPaths(route.children, `${path} ${routePath}`)
  }
}

function validateRouteMeta(path: string, route: RouteRecordRaw, routePath: string): void {
  if (!route.meta) return

  const supportedKeys = new Set(['requiresAuth', 'adminCapability'])

  for (const key of Object.keys(route.meta)) {
    if (!supportedKeys.has(key)) {
      throw new Error(`Invalid route module ${path}: unsupported meta key "${key}" at ${routePath}`)
    }
  }

  if (route.meta.requiresAuth !== undefined && typeof route.meta.requiresAuth !== 'boolean') {
    throw new Error(`Invalid route module ${path}: requiresAuth must be boolean at ${routePath}`)
  }

  if (route.meta.adminCapability !== undefined) {
    if (typeof route.meta.adminCapability !== 'string' || !isAdminCapability(route.meta.adminCapability)) {
      throw new Error(`Invalid route module ${path}: unsupported adminCapability at ${routePath}`)
    }

    if (route.meta.requiresAuth !== true) {
      throw new Error(`Invalid route module ${path}: adminCapability requires requiresAuth at ${routePath}`)
    }
  }
}

function validateNavigationItem(path: string, item: NavigationItem, itemPath: string): void {
  if (item.id.trim().length === 0) {
    throw new Error(`Invalid route module ${path}: navigation id must be non-empty at ${itemPath}`)
  }

  if (item.label.trim().length === 0) {
    throw new Error(`Invalid route module ${path}: navigation label must be non-empty at ${itemPath}`)
  }

  if (item.section.trim().length === 0) {
    throw new Error(`Invalid route module ${path}: navigation section must be non-empty at ${itemPath}`)
  }

  if (item.requiresAuth !== undefined && typeof item.requiresAuth !== 'boolean') {
    throw new Error(`Invalid route module ${path}: navigation requiresAuth must be boolean at ${itemPath}`)
  }

  if (item.adminCapability !== undefined && !isAdminCapability(item.adminCapability)) {
    throw new Error(`Invalid route module ${path}: unsupported navigation adminCapability at ${itemPath}`)
  }

  if (item.adminCapability !== undefined && item.requiresAuth !== true) {
    throw new Error(`Invalid route module ${path}: navigation adminCapability requires requiresAuth at ${itemPath}`)
  }
}

function assertNoDuplicateRouteNames(routes: RouteRecordRaw[]): void {
  const names = new Set<string>()

  for (const route of flattenRoutes(routes)) {
    if (route.name === undefined) continue

    const name = String(route.name)
    if (names.has(name)) {
      throw new Error(`Route shell manifest contains duplicate route name "${name}"`)
    }

    names.add(name)
  }
}

function assertNoDuplicateNavigationIds(navigation: NavigationItem[]): void {
  const ids = new Set<string>()

  for (const item of navigation) {
    if (ids.has(item.id)) {
      throw new Error(`Route shell manifest contains duplicate navigation id "${item.id}"`)
    }

    ids.add(item.id)
  }
}

function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.flatMap((route) => [
    route,
    ...flattenRoutes(route.children ?? []),
  ])
}

function isFeatureRouteModuleRecord(candidate: unknown): candidate is FeatureRouteModule {
  if (candidate === null || typeof candidate !== 'object') return false

  return 'feature' in candidate
    && typeof candidate.feature === 'string'
    && 'routes' in candidate
}
