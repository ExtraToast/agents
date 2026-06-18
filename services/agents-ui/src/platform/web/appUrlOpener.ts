import type { AppUrlOpener } from '../types'

export const webAppUrlOpener: AppUrlOpener = {
  async openDeepLink(url) {
    window.location.assign(url)
  },
  async openUrl(url, target = '_blank') {
    if (target === '_self') {
      window.location.assign(url)
      return
    }

    window.open(url, target, 'noopener,noreferrer')
  },
  async onAppUrlOpen() {
    return {
      async remove() {
        return undefined
      },
    }
  },
}
