// Types for the credentials feature.
//
// The request wire shapes (StartCredentialSessionInput,
// SubmitRedirectUrlInput) flow through the OpenAPI contract pinned at
// `services/agents-api/openapi.json` and the regenerated
// `src/api/generated.ts`; drift is caught by `pnpm contract:check`.
//
// `CredentialSession` and `CredentialAction` stay hand-rolled: the
// agents-api proxy returns them through `ResponseEntity<*>`, which
// springdoc emits as an untyped `object` (same as the Repository
// detail endpoint), so there is no generated schema to consume yet.

import type { components } from '@/api/generated'

export type CredentialProvider = 'claude' | 'codex'

export type StartCredentialSessionInput = components['schemas']['StartCredentialSessionRequest']
export type SubmitRedirectUrlInput = components['schemas']['SubmitRedirectUrlRequest']

/**
 * Session lifecycle mirrored from the credential worker:
 *  starting        — CLI spawned, no prompt parsed yet
 *  awaiting_url     — Claude: authorize URL emitted, waiting for the
 *                     operator to paste the post-approval redirect URL
 *  awaiting_device  — Codex: device code emitted, approve in the browser
 *  finalizing       — login accepted, capturing + writing to Vault
 *  succeeded        — credentials written
 *  failed           — parse failure, CLI crash, or Vault conflict
 *  cancelled        — operator cancelled or the session timed out
 */
export type CredentialPhase
  = | 'starting'
    | 'awaiting_url'
    | 'awaiting_device'
    | 'finalizing'
    | 'succeeded'
    | 'failed'
    | 'cancelled'

export interface CredentialSession {
  id: string
  provider: CredentialProvider
  phase: CredentialPhase
  authorizeUrl?: string | null
  deviceCode?: string | null
  verificationUrl?: string | null
  needsRedirectUrl: boolean
  message?: string | null
  error?: string | null
  updatedAt?: string | null
}

export interface CredentialAction {
  ok: boolean
  error?: string | null
}

/**
 * Non-secret summary of what is currently stored in Vault for a provider — the
 * "check" that a login actually landed. No credential material is exposed.
 */
export interface CredentialStatus {
  exists: boolean
  version: number
  updatedAt?: string | null
  updatedBy?: string | null
  schemaVersion?: string | null
}

export interface CredentialStatusResponse {
  claude: CredentialStatus
  codex: CredentialStatus
}

const TERMINAL_PHASES: ReadonlySet<CredentialPhase> = new Set(['succeeded', 'failed', 'cancelled'])

export function isTerminalPhase(phase: CredentialPhase): boolean {
  return TERMINAL_PHASES.has(phase)
}
