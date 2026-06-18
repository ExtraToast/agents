import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { initFaro, useAuth } from '@/lib/vueWebCommons'
import App from './App.vue'
import { createPlatform, initializeNativeChrome, resolvePlatform } from './platform'
import { router } from './router'
import './index.css'

async function bootstrap(): Promise<void> {
  // Real-user monitoring. See app-ui/src/main.ts for the rationale.
  void initFaro({
    appName: 'agents-ui',
    environment: import.meta.env.MODE,
    otlpUrl: import.meta.env.VITE_FARO_URL,
  })

  const app = createApp(App)
  app.use(createPinia())

  // --- Scaffold platform plugin registration slots ---
  app.use(createPlatform(await resolvePlatform()))
  // Add app-wide platform plugins here before auth and router guards run.
  // --- End scaffold platform plugin registration slots ---

  // Resolve the existing auth session before protected-route guards run.
  await useAuth().fetchUser()

  app.use(router)
  await router.isReady()
  app.mount('#app')
  await initializeNativeChrome()
}

void bootstrap()
