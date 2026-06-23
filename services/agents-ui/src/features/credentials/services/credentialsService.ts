import type { CredentialAction, CredentialProvider, CredentialSession, CredentialStatusResponse } from '../types'
import { useApiWithAuth } from '@/lib/vueWebCommons'

function api(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

export async function getStoredStatus(): Promise<CredentialStatusResponse> {
  return api().get<CredentialStatusResponse>('/credentials/status')
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
