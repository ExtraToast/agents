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
  server: {
    // Keep navigation to all jorisjonkers.dev subdomains INSIDE the app's
    // WebView: sign-in on auth.jorisjonkers.dev and launching the other apps
    // (agents./grafana./etc.) from the app launcher. Without this, Capacitor
    // hands cross-host navigation to an external browser, which breaks the
    // shared session cookie (sign-in) and makes the other apps unreachable
    // from within the app.
    allowNavigation: ['*.jorisjonkers.dev', 'jorisjonkers.dev'],
    ...(serverUrl ? { url: serverUrl, cleartext: true } : {}),
  },
}

export default config
