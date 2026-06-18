import type { DeepLinkIntent, DeepLinkResult } from './types'

export interface ParseDeepLinkOptions {
  redirectUri: string
  expectedState?: string
}

export function parseDeepLinkCallback(intent: DeepLinkIntent | string, options: ParseDeepLinkOptions): DeepLinkResult {
  const url = typeof intent === 'string' ? intent : intent.url

  if (!hasRedirectPrefix(url, options.redirectUri)) {
    return rejected('invalid_redirect_uri', 'Callback URL does not match the configured redirect URI')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return rejected('invalid_callback_url', 'Callback URL is not parseable')
  }

  const params = parsed.searchParams
  const fragmentParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash)
  const code = params.get('code') ?? fragmentParams.get('code')
  const state = params.get('state') ?? fragmentParams.get('state')
  const error = params.get('error') ?? fragmentParams.get('error')
  const errorDescription = params.get('error_description') ?? fragmentParams.get('error_description')
  const stateMatches = options.expectedState === undefined ? null : state === options.expectedState

  return {
    ok: error === null && code !== null && stateMatches !== false,
    code,
    state,
    error,
    errorDescription,
    stateMatches,
  }
}

function hasRedirectPrefix(url: string, redirectUri: string): boolean {
  return url === redirectUri || url.startsWith(`${redirectUri}?`) || url.startsWith(`${redirectUri}#`)
}

function rejected(error: string, errorDescription: string): DeepLinkResult {
  return {
    ok: false,
    code: null,
    state: null,
    error,
    errorDescription,
    stateMatches: null,
  }
}
