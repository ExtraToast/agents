import type { CapacitorConfig } from '@capacitor/cli'
import process from 'node:process'

const serverUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'dev.jorisjonkers.app',
  appName: 'Joris Jonkers',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
    },
    StatusBar: {
      // Don't let the WebView render under the OS status bar (clock/battery);
      // show a solid bar and start the web content below it.
      overlaysWebView: false,
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
