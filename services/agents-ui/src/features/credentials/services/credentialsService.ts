import type { CredentialAction, CredentialProvider, CredentialSession, CredentialStatus, CredentialStatusResponse } from '../types'
import { useApiWithAuth } from '@/lib/vueWebCommons'

function api(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function validFrom(exists: boolean, value: unknown): boolean | null {
  if (!exists) return null
  if (value === true) return true
  if (value === false) return false
  return null
}

function statusFrom(value: unknown): CredentialStatus {
  const raw = asRecord(value)
  const exists = raw.exists === true
  return {
    exists,
    valid: validFrom(exists, raw.valid),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  }
}

export async function getStoredStatus(): Promise<CredentialStatusResponse> {
  const response = asRecord(await api().get<unknown>('/credentials/status'))
  return {
    claude: statusFrom(response.claude),
    codex: statusFrom(response.codex),
  }
}

export async function startSession(provider: CredentialProvider): Promise<CredentialSession> {
  return api().post<CredentialSession>('/credentials/sessions', { provider })
}

export async function getSession(id: string): Promise<CredentialSession> {
  return api().get<CredentialSession>(`/credentials/sessions/${id}`)
}

export async function submitRedirectUrl(id: string, url: string): Promise<CredentialAction> {
  return api().post<CredentialAction>(`/credentials/sessions/${id}/redirect`, { url })
}

export async function cancelSession(id: string): Promise<CredentialAction> {
  return api().post<CredentialAction>(`/credentials/sessions/${id}/cancel`, {})
}
