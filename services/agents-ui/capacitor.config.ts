import process from 'node:process'
import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'dev.extratoast.agents',
  appName: 'ExtraToast Agents',
  webDir: 'dist',
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
