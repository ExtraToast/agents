import type { AppUrlOpener } from '../types'
import { App } from '@capacitor/app'

export const capacitorAppUrlOpener: AppUrlOpener = {
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
  async onAppUrlOpen(listener) {
    const handle = await App.addListener('appUrlOpen', (event) => {
      void listener({ url: event.url })
    })

    return {
      remove: () => handle.remove(),
    }
  },
}
