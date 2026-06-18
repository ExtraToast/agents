import type { CapacitorConfig } from '@capacitor/cli'
import process from 'node:process'

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
