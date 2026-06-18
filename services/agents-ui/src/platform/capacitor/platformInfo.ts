import type { PlatformInfo, PlatformName } from '../types'
import { Capacitor } from '@capacitor/core'

function normalizePlatform(platform: string): PlatformName {
  return platform === 'android' || platform === 'ios' ? platform : 'web'
}

export function getCapacitorPlatformInfo(): PlatformInfo {
  return {
    isNative: true,
    platform: normalizePlatform(Capacitor.getPlatform()),
  }
}
