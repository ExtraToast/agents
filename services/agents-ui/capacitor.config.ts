import type { CapacitorConfig } from '@capacitor/cli'
import process from 'node:process'

const serverUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'dev.extratoast.agents',
  appName: 'ExtraToast Agents',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1a1a2e',
    },
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: true,
        },
      }
    : {}),
}

export default config
