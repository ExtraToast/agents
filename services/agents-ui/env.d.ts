/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_URL?: string
  readonly VITE_AUTH_ORIGIN?: string
  readonly VITE_AGENTS_API_ORIGIN?: string
  readonly VITE_AGENTS_WS_ORIGIN?: string
}
