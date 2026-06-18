export type PlatformName = 'web' | 'android' | 'ios'

export interface SecureStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export interface AppUrlOpenEvent {
  url: string
}

export interface ListenerRegistration {
  remove: () => Promise<void> | void
}

export type AppUrlOpenListener = (event: AppUrlOpenEvent) => Promise<void> | void

export interface AppUrlOpener {
  openDeepLink: (url: string) => Promise<void>
  openUrl: (url: string, target?: '_blank' | '_self') => Promise<void>
  onAppUrlOpen: (listener: AppUrlOpenListener) => Promise<ListenerRegistration>
}

export interface PlatformInfo {
  isNative: boolean
  platform: PlatformName
}

export interface PlatformServices {
  secureStorage: SecureStorage
  appUrlOpener: AppUrlOpener
  platformInfo: PlatformInfo
}
