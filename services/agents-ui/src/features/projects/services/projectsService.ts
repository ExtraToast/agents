import type { GithubLink, Project, ProjectDetail } from '../types'
import type { Repository } from '@/features/repositories'
import { CredentialsModePolicy, UrlBuilder } from '@/lib/runtimeOrigins'
import { useApiWithAuth } from '@/lib/vueWebCommons'

function getApi(): ReturnType<typeof useApiWithAuth> {
  return useApiWithAuth()
}

export async function listProjects(): Promise<Project[]> {
  return getApi().get<Project[]>('/projects')
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return getApi().get<ProjectDetail>(`/projects/${id}`)
}

export async function createProject(input: { name: string; slug: string; description?: string }): Promise<Project> {
  return getApi().post<Project>('/projects', input)
}

export async function addLink(
  projectId: string,
  input: {
    name: string
    repoUrl: string
    defaultBranch?: string
  },
): Promise<GithubLink> {
  return getApi().post<GithubLink>(`/projects/${projectId}/links`, input)
}

export async function removeLink(projectId: string, linkId: string): Promise<void> {
  return getApi().del(`/projects/${projectId}/links/${linkId}`)
}

export async function attachKey(
  projectId: string,
  linkId: string,
  input: {
    privateKeyOpenssh: string
    publicKeyOpenssh: string
    knownHosts?: string
  },
): Promise<void> {
  return getApi().post(`/projects/${projectId}/links/${linkId}/key`, input)
}

/**
 * Link an existing Repository to a Project. The Project's repository
 * pool is the source of truth for which repos the operator can pick
 * when opening a workspace under that project.
 */
export async function linkRepository(projectId: string, repositoryId: string): Promise<Repository[]> {
  return getApi().post<Repository[]>(`/projects/${projectId}/repositories`, { repositoryId })
}

export async function unlinkRepository(projectId: string, repositoryId: string): Promise<void> {
  await getApi().del(`/projects/${projectId}/repositories/${repositoryId}`)
}

/**
 * Returns the markdown body of the deploy-key setup guide as a
 * string. The agents-api endpoint returns `text/markdown`; we
 * rely on the helper's text-fallback rather than the JSON path.
 */
export async function getSetupGuide(projectId: string, linkId: string): Promise<string> {
  // useApiWithAuth's `get` defaults to JSON; for a text body the
  // simplest fallback is a raw fetch with the shared credential policy.
  const init = await new CredentialsModePolicy().restRequestInit({
    headers: { Accept: 'text/markdown,text/plain' },
  })
  const path = [
    'projects',
    encodeURIComponent(projectId),
    'links',
    encodeURIComponent(linkId),
    'setup-guide',
  ].join('/')
  const resp = await fetch(
    `${new UrlBuilder().agentsApiBaseUrl()}/${path}`,
    init,
  )
  if (!resp.ok) throw new Error(`setup-guide fetch failed: ${resp.status}`)
  return await resp.text()
}
