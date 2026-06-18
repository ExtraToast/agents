import type { NativeAuthConfig } from './types'

const CODE_VERIFIER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const DEFAULT_VERIFIER_LENGTH = 64
const DEFAULT_STATE_LENGTH = 48
const AUTHORIZE_PATH = '/api/oauth2/authorize'

export interface BuildAuthorizeUrlInput {
  codeChallenge: string
  state: string
  redirectUri: string
}

export function generateCodeVerifier(length = DEFAULT_VERIFIER_LENGTH): string {
  if (!Number.isInteger(length) || length < 43 || length > 128) {
    throw new TypeError('PKCE code verifier length must be an integer between 43 and 128')
  }

  return randomUnreservedString(length)
}

export function generateState(length = DEFAULT_STATE_LENGTH): string {
  if (!Number.isInteger(length) || length < 16 || length > 128) {
    throw new TypeError('OAuth state length must be an integer between 16 and 128')
  }

  return randomUnreservedString(length)
}

export async function createS256CodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export function buildAuthorizeUrl(config: NativeAuthConfig, input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: input.redirectUri,
    state: input.state,
  })

  if (config.scope) params.set('scope', config.scope)

  return `${endpoint(config.authBaseUrl, config.authorizePath ?? AUTHORIZE_PATH)}?${params.toString()}`
}

function randomUnreservedString(length: number): string {
  const output: string[] = []
  const charsetLength = CODE_VERIFIER_CHARS.length
  const maxAcceptedByte = Math.floor(256 / charsetLength) * charsetLength

  while (output.length < length) {
    const bytes = new Uint8Array((length - output.length) * 2)
    crypto.getRandomValues(bytes)

    for (const byte of bytes) {
      if (byte >= maxAcceptedByte) continue
      output.push(CODE_VERIFIER_CHARS[byte % charsetLength] ?? '')
      if (output.length === length) break
    }
  }

  return output.join('')
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function endpoint(baseUrl: string | undefined, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!baseUrl) return normalizedPath
  return `${baseUrl.replace(/\/+$/u, '')}${normalizedPath}`
}
