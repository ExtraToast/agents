import type { RouteRecordRaw } from 'vue-router'
import type { FeatureRouteModule } from '../types'
import { describe, expect, it } from 'vitest'
import { assembleRouteManifest } from '../discovery'

const component = {}

describe('route discovery', () => {
  it('assembles fixture modules in feature order without shared registration edits', () => {
    const alpha = routeModule('alpha', [
      route('/alpha', 'alpha'),
      route('/alpha/:id', 'alpha-detail'),
    ])
    const beta = routeModule('beta', [
      route('/beta', 'beta'),
    ])

    const manifest = assembleRouteManifest({
      '../features/beta/routes.ts': { default: beta },
      '../features/alpha/routes.ts': { default: alpha },
    })

    expect(manifest.modules.map((module) => module.feature)).toEqual(['alpha', 'beta'])
    expect(manifest.routes.map((item) => item.path)).toEqual(['/alpha', '/alpha/:id', '/beta'])
  })

  it('rejects malformed modules', () => {
    expect(() => assembleRouteManifest({
      '../features/broken/routes.ts': { default: { feature: '', routes: [] } },
    })).toThrow(/feature must be non-empty/)
  })

  it('rejects duplicate route names', () => {
    expect(() => assembleRouteManifest({
      '../features/alpha/routes.ts': { default: routeModule('alpha', [route('/alpha', 'shared')]) },
      '../features/beta/routes.ts': { default: routeModule('beta', [route('/beta', 'shared')]) },
    })).toThrow(/duplicate route name "shared"/)
  })

  it('rejects duplicate sibling paths', () => {
    expect(() => assembleRouteManifest({
      '../features/alpha/routes.ts': {
        default: routeModule('alpha', [
          route('/alpha', 'alpha'),
          route('/alpha', 'alpha-copy'),
        ]),
      },
    })).toThrow(/duplicate sibling path "\/alpha"/)
  })

  it('rejects duplicate navigation ids', () => {
    expect(() => assembleRouteManifest({
      '../features/alpha/routes.ts': {
        default: routeModule('alpha', [
          route('/alpha', 'alpha'),
        ], [
          { id: 'main', label: 'Alpha', to: '/alpha', section: 'main' },
        ]),
      },
      '../features/beta/routes.ts': {
        default: routeModule('beta', [
          route('/beta', 'beta'),
        ], [
          { id: 'main', label: 'Beta', to: '/beta', section: 'main' },
        ]),
      },
    })).toThrow(/duplicate navigation id "main"/)
  })

  it('rejects unsupported route metadata', () => {
    expect(() => assembleRouteManifest({
      '../features/alpha/routes.ts': {
        default: routeModule('alpha', [
          // eslint-disable-next-line ts/consistent-type-assertions -- intentionally inject an unsupported meta key
          { ...route('/alpha', 'alpha'), meta: { requiresAuth: true, unsupported: true } } as RouteRecordRaw,
        ]),
      },
    })).toThrow(/unsupported meta key "unsupported"/)
  })
})

function route(path: string, name: string): RouteRecordRaw {
  return {
    path,
    name,
    component,
    meta: { requiresAuth: true },
  }
}

function routeModule(
  feature: string,
  routes: RouteRecordRaw[],
  navigation?: FeatureRouteModule['navigation'],
): FeatureRouteModule {
  const module: FeatureRouteModule = {
    feature,
    routes,
  }

  if (navigation !== undefined) {
    module.navigation = navigation
  }

  return module
}
