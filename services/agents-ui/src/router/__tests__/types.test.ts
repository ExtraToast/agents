import type { RouteRecordRaw } from 'vue-router'
import type { FeatureRouteModule, NavigationItem } from '../types'
import { describe, expectTypeOf, it } from 'vitest'

describe('router shell types', () => {
  it('exports frozen feature module and navigation contracts for downstream modules', () => {
    expectTypeOf<FeatureRouteModule>().toMatchTypeOf<{
      feature: string
      routes: RouteRecordRaw[]
      navigation?: NavigationItem[]
    }>()
  })
})
