import type { App, InjectionKey, Plugin } from 'vue'
import { inject } from 'vue'
import type { AppUrlOpener, PlatformInfo, PlatformServices, SecureStorage } from './types'
import { webAppUrlOpener, webPlatformInfo, webSecureStorage } from './web'

export const secureStorageKey: InjectionKey<SecureStorage> = Symbol('secureStorage')
export const appUrlOpenerKey: InjectionKey<AppUrlOpener> = Symbol('appUrlOpener')
export const platformInfoKey: InjectionKey<PlatformInfo> = Symbol('platformInfo')
export const platformServicesKey: InjectionKey<PlatformServices> = Symbol('platformServices')

function webPlatformServices(): PlatformServices {
  return {
    secureStorage: webSecureStorage,
    appUrlOpener: webAppUrlOpener,
    platformInfo: webPlatformInfo,
  }
}

export async function resolvePlatform(): Promise<PlatformServices> {
  const { Capacitor } = await import('@capacitor/core')

  if (!Capacitor.isNativePlatform()) {
    return webPlatformServices()
  }

  const [{ capacitorSecureStorage }, { capacitorAppUrlOpener }, { getCapacitorPlatformInfo }] = await Promise.all([
    import('./capacitor/secureStorage'),
    import('./capacitor/appUrlOpener'),
    import('./capacitor/platformInfo'),
  ])

  return {
    secureStorage: capacitorSecureStorage,
    appUrlOpener: capacitorAppUrlOpener,
    platformInfo: getCapacitorPlatformInfo(),
  }
}

export function createPlatform(services: PlatformServices): Plugin {
  return {
    install(app: App) {
      app.provide(platformServicesKey, services)
      app.provide(secureStorageKey, services.secureStorage)
      app.provide(appUrlOpenerKey, services.appUrlOpener)
      app.provide(platformInfoKey, services.platformInfo)
    },
  }
}

export function usePlatformServices(): PlatformServices {
  const services = inject(platformServicesKey)
  if (!services) {
    throw new Error('Platform services have not been registered')
  }
  return services
}

export type { AppUrlOpener, PlatformInfo, PlatformServices, SecureStorage } from './types'
