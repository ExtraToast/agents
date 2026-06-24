import type {
  CreateRepositoryInput,
  InstallationStatus,
  Repository,
  RepositoryDetail,
  RepositoryVerifyResult,
} from '../types'
import { useApiWithAuth } from '@/lib/vueWebCommons'

function api(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

export async function listRepositories(): Promise<Repository[]> {
  return api().get<Repository[]>('/repositories')
}

export async function getRepository(id: string): Promise<RepositoryDetail> {
  return api().get<RepositoryDetail>(`/repositories/${id}`)
}

export async function createRepository(input: CreateRepositoryInput): Promise<Repository> {
  return api().post<Repository>('/repositories', input)
}

export async function deleteRepository(id: string): Promise<void> {
  await api().del(`/repositories/${id}`)
}

export async function verifyRepositoryAccess(id: string): Promise<RepositoryVerifyResult> {
  return api().post<RepositoryVerifyResult>(`/repositories/${id}/verify`, {})
}

// Live GitHub App install-status. Backs both the initial load and the
// manual "re-check" action — it queries GitHub fresh and never mints a
// token.
export async function fetchInstallationStatus(id: string): Promise<InstallationStatus> {
  return api().get<InstallationStatus>(`/repositories/${id}/installation-status`)
}
